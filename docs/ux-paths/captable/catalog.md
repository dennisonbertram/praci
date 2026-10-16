# UX Path Catalog: Rakazo Cap Table

Generated: 2026-10-16 (read from `docs/ux-pass` at 458a69e4)
Scope: Cap Table page (`/app/cap-table`), Carta connection, the Carta agent panel, contacts, and asking the agent about equity (holders, securities, SAFEs, option pool).
Total Stories: 20

## What actually exists (read before walking)

- **The Cap Table page shows no cap table.** It is a contact list (Name, Email, Organization, Kind) with kind tabs (All / Investors / Auditors / Other), an "Add contact" button, a "Connect Carta" button (only when no connected Carta server), and a "Show Carta agent" icon button when the agent panel is collapsed (`apps/web/src/pages/CapTable.tsx:172-330`).
- **Holders, securities, SAFEs and the option pool are only reachable by chatting with the Carta agent** in the right-hand panel. The agent reads Carta through Carta's MCP server with a fixed read-only tool list: `welcome, discover, fetch, list_contexts, set_context, list_accounts, get_current_user, cap_table_chart, cap_table_healthcheck` (`packages/contracts/src/carta.ts:27-37`). It can never change Carta.
- **Connect Carta leaves the page**: it navigates to `/app/integrations?q=carta`, where the "Carta" tile (section "Equity", description "Cap table, equity and investors") opens the custom-connection dialog prefilled with `https://mcp.app.carta.com/mcp` (`Shell.tsx:4121`, `lib/integrations.ts:124-131`, `IntegrationsHome.tsx:585-597`).
- **A server counts as Carta only by host `mcp.app.carta.com` over https** (`contracts/src/carta.ts:13-21`). There is no "sync" button, no sync status, and no stored cap table data; every answer is a live read by the agent.
- **The agent** ("Carta agent", spawn key `carta-agent:<userId>`) is created with the "Create Carta agent" button in the panel (`Shell.tsx:2556-2567, 2612-2623, 4193`). It can list contacts freely and save contacts only after an approval card ("Save contact “…”", `approval-ask.ts:94-96`). Built-in skills: `carta-investor-update`, `carta-audit-response` (`builtin-skills.ts:155-185`). Every email send needs per-message approval with full recipients and body.
- **Not built** (do not walk as features): cap table dashboard, routine suggestions for audit season / investor updates (planned in `docs/carta/README.md` decision 8, no code found), contact search on the page, bulk import, writes to Carta.

## Mock demo data (seed once for the whole catalog)

Company / space name: **MOCK DEMO DATA — Northwind Robotics**. Signed-in founder: "Maya Chen" (`maya@northwind-robotics.test`), onboarding complete.

| Seed set | Contents |
|---|---|
| `contacts-base` | Investors: "Priya Raman", priya@sequoia-mock.test, "Sequoia Mock Capital"; "Tom Okafor", tom@lighthouse-mock.test, "Lighthouse Mock Ventures"; "Lena Fischer" (angel), lena.fischer@mock.test, no organization. Auditor: "Daniel Ortiz", dortiz@kpmg-mock.test, "KPMG Mock (auditor for Lighthouse Mock Ventures)". Other: "Sam Lee", sam@cooley-mock.test, "Cooley Mock LLP", notes "Company counsel". |
| `contacts-empty` | No contacts. |
| `carta-none` | No MCP server with a Carta endpoint. |
| `carta-connected` | Enabled MCP server with endpoint `https://mcp.app.carta.com/mcp`, OAuth status `connected`. Because Carta is matched by host, the walk needs either a Carta sandbox account or an MCP stub reachable at that host (DNS/proxy override). A stub on another host will NOT count as Carta. |
| `carta-needs-auth` | Same server row, OAuth not completed / expired (status not `connected`). |
| `carta-fixture` (served by the Carta sandbox or stub) | Company "MOCK DEMO DATA — Northwind Robotics", 10,000,000 fully diluted shares. Common: Maya Chen 4,000,000; co-founder "Arjun Patel" 3,000,000. Option pool 1,500,000 reserved (600,000 granted to 4 employees, 900,000 available). Series Seed Preferred: Sequoia Mock Capital 1,000,000. SAFEs not yet converted: Lighthouse Mock Ventures $500,000 post-money cap $10M (2026-03-01); Lena Fischer $50,000 same terms. Second context "MOCK DEMO DATA — Northwind Labs (inactive)" to exercise `list_contexts`/`set_context`. One deliberate healthcheck issue (an unvested grant past its cliff with no vesting event). |
| `agent-none` / `agent-exists` | No Carta agent bot, or a Carta agent already created. |
| `gmail-connected` | Gmail connected with: 2 sent "Northwind investor update" emails (July, August 2026); 1 audit confirmation request from dortiz@kpmg-mock.test asking Lighthouse Mock Ventures' holdings as of 2025-12-31 with figures "SAFE $500,000"; 1 DocuSign envelope email "Please sign: Audit confirmation – Lighthouse Mock Ventures" with no figures. |
| `finance-connected` | Finance source with cash $2.4M, monthly burn $180k (for investor update drafts). |

## Summary

| Type | Count |
|---|---|
| Short | 12 |
| Medium | 4 |
| Long | 4 |

## Coverage Matrix

| Feature area | Stories | Gaps |
|---|---|---|
| Find Cap Table page / first impression | 001, 002, 017 | none |
| Carta connection | 003, 004, 005, 017 | no "sync" exists to cover |
| Carta agent panel (create, collapse, reopen, open full) | 006, 007, 008 | — |
| Contacts CRUD and filtering | 009, 010, 011, 012, 013 | no search on page (not built) |
| Ask about holders / securities / SAFEs / option pool | 014, 015, 016, 018 | as-of-date holdings depend on Carta `fetch` (TBD in docs) |
| Agent saves contacts with approval | 016, 019 | — |
| Investor update / audit skills | 018, 019, 020 | routine suggestions not built |
| Errors / empty states | 002, 005, 011, 013 | — |

## Story Dependency Graph

```text
STORY-001 (find Cap Table)
├── STORY-002 (empty page) ── STORY-009 (add first contact) ── STORY-010/011/012/013
├── STORY-003 (connect Carta) ── STORY-004 (back to page) ── STORY-005 (expired auth)
│   └── STORY-006 (create agent) ── STORY-007/008 (panel)
│       └── STORY-014/015/016 (equity questions) ── STORY-018/019/020 (long flows)
└── STORY-017 (long: first visit to working setup)
```

## All Stories

### Finding the page and first impression

## STORY-001: "Where do I see who owns my company?"

**Type**: short
**Topic**: Navigation
**Persona**: First-time founder (Maya), just finished onboarding, has never opened Cap Table.
**Goal**: Find where the product keeps ownership information.
**Preconditions**: `contacts-base`, `carta-none`, `agent-none`.
**Ideal path**: 1 — one sidebar click should land on an ownership view.
**Alternate paths**: Typing `/app/cap-table` directly; none other in the UI.

### Steps
1. Scan the left sidebar for anything about ownership or equity → finds "Cap Table" (pie-chart icon) under "Finance", above "Data room" (`Shell.tsx:3332-3341`).
2. Click "Cap Table" → URL `/app/cap-table`; heading "Cap Table"; buttons "Connect Carta", "Add contact"; tabs All / Investors / Auditors / Other; a table of 5 people; a right panel with a "Create Carta agent" button.
3. Look for share counts or a pie chart → none. **Hesitation:** the page is titled "Cap Table" with a pie icon, but it lists people and emails. A founder will expect percentages and wonder if data failed to load.

### Variations
- Phone width: the sidebar is behind a menu; Organization column is hidden below the `@md` container width (`CapTable.tsx:290`).

### Edge Cases
- If the founder expects "Equity" (the Integrations section name), there is no sidebar item by that name.

## STORY-002: Empty Cap Table on day one

**Type**: short
**Topic**: Empty states
**Persona**: First-time founder with nothing set up.
**Goal**: Understand what to do on an empty page.
**Preconditions**: `contacts-empty`, `carta-none`, `agent-none`.
**Ideal path**: 1 — the empty state should say what to do next and offer the button.
**Alternate paths**: none found.

### Steps
1. Open Cap Table → brief 3-row skeleton, then "No contacts yet" centred; "Connect Carta" and "Add contact" in the header; right panel "Create Carta agent".
2. Decide what to click first → no text explains that Carta is where ownership comes from or what the agent does. **Hesitation:** three equal calls to action with no order.

### Edge Cases
- Contacts load fails → red "Could not load contacts" (or server text) + "Try again" (`CapTable.tsx:263-269`).

### Connecting Carta

## STORY-003: Connect Carta for the first time

**Type**: medium
**Topic**: Carta connection
**Persona**: Founder whose company is on Carta and who has a Carta login.
**Goal**: Link Carta so the product can see the cap table.
**Preconditions**: `carta-none`, `agent-none`, Carta sandbox/stub reachable at `mcp.app.carta.com` with `carta-fixture`.
**Ideal path**: 3 — click Connect Carta, approve in Carta's OAuth screen, return to Cap Table.
**Alternate paths**: Sidebar → Integrations → search "carta" → Carta tile; or Integrations → "Add custom connection" and paste `https://mcp.app.carta.com/mcp` by hand (counts as Carta because the host matches).

### Steps
1. On Cap Table, click "Connect Carta" → the app leaves Cap Table and opens Integrations with the search box prefilled "carta" (`Shell.tsx:4121`). **Hesitation:** the founder expected a popup, not a different page.
2. Find the "Carta" tile under "Equity" ("Cap table, equity and investors") → click its connect button.
3. A custom connection dialog opens prefilled with `https://mcp.app.carta.com/mcp` → **Hesitation:** "custom connection" and an MCP URL look technical; a first-timer may think they must change something.
4. Confirm → Carta OAuth sign-in in a new window/redirect → approve.
5. Return to Integrations → Carta shows as connected.
6. Click "Cap Table" in the sidebar → "Connect Carta" button is gone.

### Variations
- Agent already exists (`agent-exists`): on save, the server gives the existing agent the read tools (`router.ts:4409-4411`).

### Edge Cases
- Founder cancels OAuth → server row exists but status not `connected`; Cap Table still shows "Connect Carta" (see STORY-005).

## STORY-004: Did the connection work?

**Type**: short
**Topic**: Carta connection
**Persona**: Founder just back from Carta's sign-in.
**Goal**: Confirm Carta is linked and see their data.
**Preconditions**: `carta-connected`, `contacts-base`, `agent-none`.
**Ideal path**: 1 — the Cap Table page should show a connected state or data.
**Alternate paths**: Integrations page connection list.

### Steps
1. Open Cap Table → "Connect Carta" button is absent. That is the only sign of success.
2. Look for a "Synced" label, last-sync time, or numbers → none. **Hesitation:** "nothing changed — did it import anything?" The page never shows Carta data; the founder has to discover the agent panel.

### Edge Cases
- `rpc.mcp.servers.list` fails → the page assumes connected and hides "Connect Carta" (`CapTable.tsx:182, 214`).

## STORY-005: Carta sign-in expired

**Type**: short
**Topic**: Errors / Carta connection
**Persona**: Founder returning after weeks away.
**Goal**: Ask the agent something and get an answer.
**Preconditions**: `carta-needs-auth`, `agent-exists`, `contacts-base`.
**Ideal path**: 2 — see a "reconnect" notice, click it.
**Alternate paths**: Integrations page.

### Steps
1. Open Cap Table → "Connect Carta" is shown again even though Carta was connected before (status is not `connected`).
2. Click it → Integrations filtered to "carta"; the founder must find the existing connection and re-authorise rather than add a second one. **Hesitation:** "Connect" not "Reconnect"; risk of creating a duplicate server.
3. Ask the agent "How many shares do I own?" before reconnecting → observe how the agent reports a failed Carta call (record exact text).

### The Carta agent panel

## STORY-006: Create the Carta agent

**Type**: short
**Topic**: Agent panel
**Persona**: First-time founder.
**Goal**: Get the assistant that can answer equity questions.
**Preconditions**: `agent-none`, `carta-connected` (also run with `carta-none`).
**Ideal path**: 1 — one click, or the agent exists already.
**Alternate paths**: none in UI (`bots.create` rejects the reserved key).

### Steps
1. In the right panel click "Create Carta agent" → button disables; on success the panel header shows avatar + "Carta agent" and the chat appears.
2. Read the empty chat → no starter prompts about Carta. **Hesitation:** what can I ask?

### Variations
- With `carta-none`: creation still succeeds, but the agent has no Carta tools until Carta is connected (`carta-agent.ts:20-45`). Nothing on screen says so.

### Edge Cases
- Failure → red text "Could not create the Carta agent" under the button (`Shell.tsx:2563`).

## STORY-007: Hide and bring back the agent

**Type**: short
**Topic**: Agent panel
**Persona**: Founder who wants more room for the contact table.
**Goal**: Collapse the side panel and get it back.
**Preconditions**: `agent-exists`, `contacts-base`.
**Ideal path**: 2 — collapse, re-open.
**Alternate paths**: Leaving and returning to Cap Table re-opens the panel automatically (`Shell.tsx:897-899`).

### Steps
1. Click the panel's "Collapse Carta agent" icon (PanelRightClose) → panel closes; a "Show Carta agent" icon (PanelRightOpen) appears next to "Add contact".
2. Click "Show Carta agent" → panel returns with chat history.
3. Navigate to Inbox and back → panel is open again regardless of previous choice. **Hesitation:** preference not remembered (unlike the Inbox agent, which has a stored collapsed preference).

## STORY-008: Open the agent full screen

**Type**: short
**Topic**: Agent panel / navigation
**Persona**: Founder wanting a bigger chat for a long answer.
**Goal**: Chat with the Carta agent on its own page.
**Preconditions**: `agent-exists`.
**Ideal path**: 1.
**Alternate paths**: Panel header name button → `openBot`; the "Carta agent" entry in the bots sidebar list (bot lists are not filtered by spawn key).

### Steps
1. Click "Carta agent" (name + avatar) in the panel header → app navigates to the bot's own route; Cap Table page is gone.
2. Look for a way back to the contact list → only the sidebar "Cap Table" link.

### Edge Cases
- Same chat thread shown in two places (panel and bot page) — redundancy noted below.

### Contacts

## STORY-009: Add an investor by hand

**Type**: short
**Topic**: Contacts
**Persona**: Founder who just closed an angel check.
**Goal**: Record "Rita Gomez" (rita@gomez-angel.test, angel) as an investor.
**Preconditions**: `contacts-base`.
**Ideal path**: 3 — open form, fill, save.
**Alternate paths**: Ask the agent "Add Rita Gomez, rita@gomez-angel.test, as an investor" → approval card "Save contact “Rita Gomez”" → approve (STORY-016).

### Steps
1. Click "Add contact" → dialog "Add contact" with Name (required), Email, Organization, Kind (defaults to "Investor"), Notes.
2. Fill Name, Email; leave Organization empty; Notes "Angel, $25k SAFE, Oct 2026".
3. Click "Save" → dialog closes, list reloads, "Rita Gomez" appears in alphabetical order.
4. **Hesitation:** the founder typed the check amount in Notes; it does not reach Carta and nothing says Carta is unaffected.

### Edge Cases
- Invalid email → browser `type=email` validation blocks submit.
- Save disabled until Name has non-space text.

## STORY-010: Fix a contact's details

**Type**: short
**Topic**: Contacts
**Persona**: Founder whose investor changed firms.
**Goal**: Change Tom Okafor's organization.
**Preconditions**: `contacts-base`.
**Ideal path**: 3 — click name, edit, save.
**Alternate paths**: Ask the agent to update (it matches by email, never by id; `contact-tools.ts:52-56`).

### Steps
1. Click "Tom Okafor" (name is a button; only the name is clickable, not the row) → "Edit contact".
2. Change Organization → "Save" → table updates.

### Edge Cases
- Change email to priya@sequoia-mock.test → red alert "Another contact already has this email." (`db/src/contacts.ts:8`).
- Clear Organization → saved as empty (null).

## STORY-011: Add a contact who already exists

**Type**: short
**Topic**: Contacts / error
**Persona**: Founder who forgot Priya was already listed.
**Goal**: Add "Priya R." with priya@sequoia-mock.test, kind Other.
**Preconditions**: `contacts-base`.
**Ideal path**: 2 — the form should warn "already exists — open it?".
**Alternate paths**: none.

### Steps
1. "Add contact" → Name "Priya R.", Email priya@sequoia-mock.test, Kind "Other", Notes empty → Save.
2. Dialog closes with no warning; the list still has one row for that email, now named "Priya R.", kind Other, organization and notes cleared. **Problem:** a create with a known email silently overwrites the existing contact (`db/src/contacts.ts:63-70`).

## STORY-012: See only auditors

**Type**: short
**Topic**: Contacts / filter
**Persona**: Founder in audit season.
**Goal**: List auditor contacts.
**Preconditions**: `contacts-base`.
**Ideal path**: 1.
**Alternate paths**: Ask the agent "Who are my auditor contacts?" (`contacts_list` kind auditor).

### Steps
1. Click tab "Auditors" → only Daniel Ortiz.
2. Click "Other" → Sam Lee. Click "All" → 5 rows.

### Edge Cases
- With only investors seeded, "Auditors" shows "No contacts yet" — wrong message when contacts exist (`CapTable.tsx:276-278`).
- Tab choice is not in the URL; reload resets to "All".

## STORY-013: Delete a contact by mistake

**Type**: short
**Topic**: Contacts / destructive
**Persona**: Founder tidying the list.
**Goal**: Delete Sam Lee (wanted), then realise it could have been the wrong person.
**Preconditions**: `contacts-base`.
**Ideal path**: 3 — open, delete, confirm (or undo).
**Alternate paths**: none (the agent has no delete tool).

### Steps
1. Click "Sam Lee" → "Edit contact" → red "Delete" at bottom left.
2. Click "Delete" → contact is removed immediately; no confirmation, no undo (`CapTable.tsx:151-160`).

### Asking the agent about equity

## STORY-014: "Who owns what?"

**Type**: medium
**Topic**: Ask agent — holders
**Persona**: Founder preparing for a board call.
**Goal**: See ownership percentages by holder.
**Preconditions**: `carta-connected` with `carta-fixture`, `agent-exists`.
**Ideal path**: 2 — open page, read a chart (or ask once).
**Alternate paths**: Opening the Carta agent full screen (STORY-008).

### Steps
1. In the panel type "Who owns my company and what percent each?" → agent calls Carta (`set_context` if needed, `cap_table_chart`/`fetch`).
2. Expected answer: Maya 40%, Arjun 30%, Sequoia Mock Capital 10%, option pool 15% (6% granted / 9% available), fully diluted 10,000,000; SAFEs listed separately as unconverted.
3. Ask "Is that fully diluted?" → agent explains basis.
4. Check that no figure is invented; missing values should say TBD (agent instructions, `carta-agent.ts:10`).

### Variations
- Two Carta companies (`list_contexts` returns two) → agent should ask which company or pick "Northwind Robotics" and say so.

## STORY-015: SAFEs and the option pool

**Type**: medium
**Topic**: Ask agent — securities, SAFEs, option pool
**Persona**: Founder planning a Series A.
**Goal**: Understand outstanding SAFEs and how much of the pool is left.
**Preconditions**: `carta-connected` + `carta-fixture`, `agent-exists`.
**Ideal path**: 2 questions.
**Alternate paths**: none.

### Steps
1. Ask "What SAFEs haven't converted yet?" → Lighthouse Mock Ventures $500,000 and Lena Fischer $50,000, $10M post-money cap, dates.
2. Ask "How many options can I still grant?" → 900,000 of 1,500,000.
3. Ask "What happens to ownership if the SAFEs convert at the cap?" → agent should compute (post-money: $550k/$10M = 5.5%) and say it is an estimate.
4. Ask "Grant 50,000 options to our new hire Jo" → agent must say it cannot change Carta (read-only) and tell the founder to do it in Carta.

### Edge Cases
- `cap_table_healthcheck` → should surface the seeded vesting issue when asked "Anything wrong with my cap table?".

## STORY-016: Agent finds investors missing from contacts

**Type**: medium
**Topic**: Ask agent + contacts
**Persona**: Founder who wants the contact list to match Carta.
**Goal**: Add Carta investors that are not in contacts.
**Preconditions**: `carta-fixture`, `carta-connected`, `agent-exists`, `contacts-base` minus Tom Okafor.
**Ideal path**: 3 — ask, approve, see the list update.
**Alternate paths**: Add by hand (STORY-009).

### Steps
1. Ask "Are all my Carta investors in my contacts?" → agent compares `contacts_list` with Carta; names Lighthouse Mock Ventures as missing and offers to add.
2. Say "yes" → approval card "Save contact “…”" with name/email/organization/kind lines (`approval-ask.ts:94-123`).
3. Approve → contact saved.
4. Look at the contact table beside the chat → **Hesitation:** the table does not reload by itself (it loads once on mount, `CapTable.tsx:188-199`); the new contact appears only after leaving and returning.

### Edge Cases
- Carta has no email for the holder → agent may save without email (allowed) or ask for one.
- Reject the card → nothing saved.

### Long end-to-end stories

## STORY-017: First visit to a working setup

**Type**: long
**Topic**: End-to-end onboarding
**Persona**: Maya, first day in the product, company on Carta.
**Goal**: Go from nothing to asking "what's my ownership?" and getting an answer.
**Preconditions**: `contacts-empty`, `carta-none`, `agent-none`, Carta sandbox/stub with `carta-fixture`.
**Ideal path**: 5 — open Cap Table, connect, approve OAuth, create agent (or auto), ask.
**Alternate paths**: Integrations first, then Cap Table.

### Steps
1. Sidebar → "Cap Table" → empty page, "No contacts yet".
2. Click "Create Carta agent" first (it is the most prominent thing on the right) → agent created.
3. Ask "What's my ownership?" → agent has no Carta tools yet; record what it says (should tell her to connect Carta).
4. Click "Connect Carta" → lands on Integrations, search "carta".
5. Click the Carta tile → prefilled dialog → confirm → OAuth → approve.
6. Back to Integrations → connected.
7. Sidebar → "Cap Table" → "Connect Carta" gone; panel open.
8. Ask again in the same thread → agent now reads Carta (server assigned to existing agent, `router.ts:4411`) → ownership breakdown.
9. Ask "Who are my investors?" → Sequoia Mock Capital, Lighthouse Mock Ventures, Lena Fischer.
10. Ask "Add them to my contacts" → three approval cards, one per contact → approve each.
11. Leave and return to Cap Table → three Investors rows appear.
12. Click "Investors" tab → the three rows.
13. Open "Lena Fischer" → add email lena.fischer@mock.test → Save.
14. Collapse the agent → wider table; "Show Carta agent" to bring it back.
15. **Friction points to record:** leaving the page to connect, no success state on Cap Table, the stale contact table after agent saves, one approval per contact.

## STORY-018: Monthly investor update

**Type**: long
**Topic**: Skill carta-investor-update
**Persona**: Founder who owes investors the September update.
**Goal**: Get a draft in Gmail addressed to all investors.
**Preconditions**: `carta-connected`+`carta-fixture`, `agent-exists`, `contacts-base`, `gmail-connected`, `finance-connected`.
**Ideal path**: 4 — ask, give highlights, review draft, approve.
**Alternate paths**: Pick skill "carta-investor-update" in the composer skill selector vs plain request "write my investor update".

### Steps
1. Ask "Write my September investor update" (or choose the skill) → agent picks period, calls `finance_overview` / `finance_breakdown` → cash $2.4M, burn $180k, runway ~13 months.
2. Agent reads ownership changes from Carta and recipients via `contacts_list` kind investor.
3. Agent flags any Carta investor not in contacts and asks before saving.
4. Agent reads the July and August sent updates for tone.
5. Agent asks for highlights, lowlights, asks → founder answers in chat.
6. Agent saves a Gmail draft to Maya with investors in Bcc; shows it; lists TBD items (e.g. revenue).
7. Founder opens Inbox/Gmail to check the draft.
8. **Hesitation:** whether the update was sent — it is only a draft; the skill never sends.

### Edge Cases
- Lena Fischer has no email in contacts → recipient missing; agent should say so.

## STORY-019: Auditor confirmation request

**Type**: long
**Topic**: Skill carta-audit-response
**Persona**: Founder who got an audit email from Lighthouse's auditor.
**Goal**: Reply with correct holdings.
**Preconditions**: `carta-connected`+`carta-fixture`, `agent-exists`, `contacts-base` minus Daniel Ortiz, `gmail-connected`.
**Ideal path**: 4 — ask, review comparison, approve save, approve send.
**Alternate paths**: skill selector vs "do I have any audit requests?".

### Steps
1. Ask "Any auditor requests I need to answer?" → `mail_search` + `mail_grep` find the KPMG Mock email and the DocuSign envelope.
2. Agent extracts fund (Lighthouse Mock Ventures), as-of 2025-12-31, items (SAFE $500,000).
3. Agent offers to save Daniel Ortiz as an auditor → approval card → approve.
4. Agent compares with Carta: SAFE dated 2026-03-01 — after the as-of date — so the holding as of 2025-12-31 should be $0; reports the difference exactly.
5. DocuSign email has no figures → agent gives the Carta numbers to check inside DocuSign and does not say "sign it".
6. Agent drafts a reply; "still needed from you" list.
7. Founder asks to send → approval card shows full to/cc/bcc/subject/body → approve → sent.
8. Check Cap Table → "Auditors" tab shows Daniel Ortiz (after reload).

### Edge Cases
- Agent tries to send by draft id only → refused (`executor.ts:4415`).
- Carta `fetch` cannot answer as-of-date holdings → agent must say so (open risk in `docs/carta/README.md`).

## STORY-020: Board prep in one sitting

**Type**: long
**Topic**: Cross-area
**Persona**: Founder with a board meeting tomorrow.
**Goal**: Know the cap table, pool, SAFE exposure, and who to email.
**Preconditions**: `carta-connected`+`carta-fixture`, `agent-exists`, `contacts-base`.
**Ideal path**: 4 questions in one chat.
**Alternate paths**: Finance page agent for cash numbers (separate Finance agent).

### Steps
1. Cap Table → panel → "Summarise my cap table for the board" → ownership table.
2. "Anything wrong with it?" → healthcheck finding.
3. "Option pool left?" → 900,000.
4. "If we raise $3M at $15M pre, what's the dilution?" → estimate, labelled as such.
5. "Which board members are in my contacts?" → agent can only list contacts; there is no "board member" kind (Investor/Auditor/Other). **Hesitation:** where to put counsel and board members — "Other".
6. Collapse panel, review Investors tab, click "Sam Lee" to check notes "Company counsel".
7. Ask for cash and runway → the Carta agent has `finance_*` tools; compare with the Finance page agent's answer — two agents can answer the same question.

## Redundancy Candidates

### Duplicate paths (same goal, multiple routes)
- Connect Carta: Cap Table "Connect Carta" → Integrations `?q=carta` → Carta tile; Integrations directly; Integrations "Add custom connection" with the Carta URL pasted. All produce the same server row.
- Add/update a contact: the "Add contact" dialog and the agent's `contacts_save`. They behave differently: the dialog upserts by email silently, the agent requires an approval card; the agent can never update by id.
- Talk to the Carta agent: Cap Table side panel, the agent's own bot page (panel header name button), and the bots list entry.
- Re-open the agent panel: "Show Carta agent" button, or leave and come back to Cap Table (auto-reopens).
- Run an investor update/audit: skill selector in the composer vs free-text request.

### Duplicate information (same fact, multiple surfaces)
- Carta connection status: Integrations page and (indirectly) presence/absence of "Connect Carta" on Cap Table.
- Contact list: Cap Table table and agent `contacts_list` replies in chat.
- Cash/burn/runway: Finance page/Finance agent and the Carta agent (`finance_*` tools).
- Carta agent chat thread: side panel and full bot page.

### Overlapping features/tools
- Finance agent and Carta agent both answer cash and runway questions.
- Contact "Kind" tabs on the page and `contacts_list` kind filter in chat.
- Cap Table "Notes" field vs Carta holdings data: a founder may record investment amounts in Notes that duplicate (and drift from) Carta.

## Suspected problems

1. **Page title promises a cap table but shows a contact list.** Heading "Cap Table" with a pie-chart sidebar icon; body is Name/Email/Organization/Kind. No ownership, holders, SAFEs or pool on screen; equity is chat-only. `apps/web/src/pages/CapTable.tsx:228-230, 281-318`; `apps/web/src/pages/Shell.tsx:3332-3341`.
2. **"Add contact" silently overwrites an existing contact with the same email**, clearing organization/notes and changing kind, with no warning. `apps/web/src/pages/CapTable.tsx:70-79` (no id on create) → `packages/db/src/contacts.ts:63-70` (upsert by email).
3. **Contact table does not refresh after the agent saves a contact** in the panel beside it; it loads once on mount. `apps/web/src/pages/CapTable.tsx:187-199`.
4. **Delete has no confirmation or undo.** `apps/web/src/pages/CapTable.tsx:151-160`.
5. **"Connect Carta" is hidden by default and stays hidden if the server list call fails**, so a first-timer may never see it. `apps/web/src/pages/CapTable.tsx:182, 200-215`.
6. **"Connect Carta" navigates away to Integrations and opens a technical "custom connection" dialog with an MCP URL**, and the same label is used when re-authorising an expired connection (risk of duplicate servers). `apps/web/src/pages/Shell.tsx:4121`; `apps/web/src/components/integrations/IntegrationsHome.tsx:585-597`.
7. **No success state or data after connecting Carta** — only the button disappears; no "connected", last-read time, or company name. `apps/web/src/pages/CapTable.tsx:231-235`.
8. **Carta agent can be created before Carta is connected** with nothing telling the founder it has no Carta access yet. `apps/web/src/pages/Shell.tsx:2556-2567, 4191-4200`; `apps/api/src/carta-agent.ts:20-45`.
9. **Filtered empty tab says "No contacts yet"** even when contacts exist in other kinds. `apps/web/src/pages/CapTable.tsx:276-278`.
10. **Agent panel collapse is not remembered** (always re-opens on return), unlike the Inbox agent's stored preference. `apps/web/src/pages/Shell.tsx:508-509, 897-899`.
11. **Only the name text opens a contact**, not the row, though the row has a hover highlight suggesting it is clickable. `apps/web/src/pages/CapTable.tsx:300-308`.
12. **Contact kinds are only Investor/Auditor/Other**; board members, counsel, employees with options all fall into "Other". `packages/contracts/src/contacts.ts:4`.
13. **Walk infrastructure risk:** Carta is recognised only by host `mcp.app.carta.com`, so a mock MCP server on another host cannot stand in for Carta in the demo account. `packages/contracts/src/carta.ts:10-21`.
14. **Planned routine suggestions (audit season, investor update) are not implemented**; the docs promise them on agent creation. `docs/carta/README.md` decision 8; no code found under `apps/` or `packages/`.
