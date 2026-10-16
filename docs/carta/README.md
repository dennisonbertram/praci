# Carta agent plan

## Goal

A Carta agent that knows the company's cap table and investors and takes the two
recurring investor chores off the founder:

1. **Investor updates.** Draft the monthly or quarterly update from real numbers
   (cash, burn and runway from Finance, ownership changes from Carta) and the
   founder's notes, in the voice of past updates, as a Gmail draft addressed to the
   investors listed in Carta.
2. **Investor audit requests.** Every year each fund's auditor asks the company to
   confirm what that fund holds (shares, SAFEs, notes, as of the fund's year end)
   and often asks for financials, the latest 409A and financing documents. The agent
   finds these requests in Gmail, checks the auditor's figures against Carta,
   gathers the documents, and drafts the reply with a list of anything it could not
   answer.

The agent also answers ad hoc questions ("who owns what after the SAFE converts",
"what did Fund X invest and when").

Web and desktop (Electron hosts the web UI) ship first. The agent is an ordinary
bot, so its chat already works on mobile; nothing mobile-specific is planned.

The user is the **company** side of Carta (an issuer), not a fund (confirmed
2026-10-15). Audit requests arrive by email, often as DocuSign envelopes and
sometimes as a plain email or attached letter.

## What Carta's MCP server offers

Observed on 2026-10-15 without signing in:

- Endpoint `https://mcp.app.carta.com/mcp`, Streamable HTTP, OAuth 2.1 with PKCE
  and dynamic client registration (`/register`), so no vendor approval is needed.
- OAuth scopes: `openid`, `cuid`, `read_mcp_companies`, `readwrite_mcp_companies`,
  `read_mcp_firms`, `readwrite_mcp_firms`, `read_mcp_crm`, `readwrite_mcp_crm`.
- Tools listed in Claude's connector directory: `welcome`, `discover`, `fetch`,
  `list_contexts`, `set_context`, `list_accounts`, `get_current_user`,
  `cap_table_chart`, `cap_table_healthcheck`. Public sources describe read and
  analysis use only; Carta has said write tools are coming.

TBD before build: the real `tools/list` and input schemas after sign-in, whether
`fetch` can return holdings **as of a past date** (the core of an audit
confirmation), and whether documents (409A report, SPAs, board consents) are
reachable through it. PR 1 records this in this file.

## Decisions

1. **Connection reuses the Carta tile** that the first-party tiles PR adds on
   Integrations (branch `feat/carta-connection`: a tile that opens the custom
   connection dialog prefilled with the endpoint). This plan builds on that PR. A
   server counts as Carta by its endpoint host, through one helper in
   `packages/contracts/src/carta.ts` (`isCartaEndpoint`), like
   `financeProviderForEndpoint`.
2. **The agent follows the Finance agent's pattern.** Spawn key
   `carta-agent:<userId>` (`cartaAgentSpawnKey`, `isCartaAgentSpawnKey`), created
   idempotently by `ensureCartaAgent` in `apps/api/src/carta-agent.ts` and exposed
   as RPC `carta.agent`. `bots.create` rejects the reserved prefix
   (`router.ts`, next to the `finance-agent:` check).
3. **"Cap Table" in the sidebar opens the Carta agent.** A `SidebarPageLink`
   (`sidebar-cap-table`) under Finance in `Shell.tsx` routes to `/app/cap-table`.
   With Carta connected, the route calls `carta.agent` and shows the Carta agent's
   chat full width; without it, the page shows only "Connect Carta", which opens
   the Integrations Carta tile's dialog. No cap table dashboard and no stored
   cap table data in v1; a dashboard needs Carta's real tool output first.
4. **Carta is read-only for the agent.** `CARTA_READ_TOOLS` lists the allowed tools
   explicitly; `assignCartaServers` writes them to `BotMcpServer.allowedTools`, and
   `assignmentAllowsTool` in `mcp-connector.ts` enforces the list for this spawn key
   even when `allowAllTools` is set (the Finance agent's guard). If Rakazo's OAuth
   client can request scopes per server, request only the `read_*` scopes.
   `set_context` stays allowed because it selects a company, not data.
5. **Writing happens in Gmail and Drive, and every send is approved by hand.** The
   agent uses the built-in `mail_search`, `mail_grep`, `mail_get`, `mail_draft`,
   `mail_send`, `drive_search`, `drive_read` and `drive_create_file`, and gets no
   Composio or Pipedream tools.
   - Being on `APPROVAL_REQUIRED_BUILTIN_TOOLS` is not enough: a saved rule or
     Auto Review can let those run (`planActionGate`). For the Carta spawn key,
     `mail_send` goes through the mandatory path (`toolRequiresExplicitApproval`,
     `executor.ts` `requiresMandatoryApproval`), which skips rules and Auto Review.
   - `mail_send` with only a `draftId` does not load the draft
     (`mail-tools.ts`), so the approval card would not show the message, and the
     draft could change after approval. The Carta agent always sends with full
     arguments (to, cc, bcc, subject, body), and is refused a draft-id-only
     send. Its approval card shows every recipient, Bcc included, and the whole
     body, not the truncated summary (`approval-ask.ts`).
6. **It reads Finance numbers through the existing tools.** `financeToolsAllowed`
   is widened to the Carta spawn key so `finance_overview` and `finance_breakdown`
   supply cash, burn and runway. No new finance code.
7. **Two built-in skills**, added to `packages/adapters/src/builtin-skills.ts` (no
   migration):
   - `carta-investor-update`: pick the period; pull metrics from `finance_*`;
     pull ownership and new investors from Carta; read the last two sent updates
     in Gmail for structure and tone; ask the founder for highlights, lowlights
     and asks if they are not in the chat; save a Gmail draft to the founder with
     investors in Bcc. It never invents a metric: anything missing is marked TBD in
     the draft.
   - `carta-audit-response`: find audit and confirmation requests from the last
     120 days with `mail_grep` (`mail_search` returns only a summary of the first
     and last few results); for each, extract the fund, the as-of date and every item
     asked; answer holdings from Carta as of that date and flag any difference from
     the auditor's figures; find the requested documents in Drive (and the Data
     room once it exists); draft the reply with attachments listed, plus a short
     "still needed from you" list, then ask to send it. **DocuSign requests:** the
     agent cannot open or sign an envelope. It reads what the email body shows
     (sender, fund, due date, any figures), checks those against Carta,
     and tells the founder either "the figures match, sign it" or exactly what
     differs and the reply to send the auditor instead. When the email has no
     figures, it gives the founder the Carta numbers to compare inside DocuSign.
     It never signs or confirms on the founder's behalf, and never answers in a
     confirmation portal. **Attachments:** `mail_get` returns headers and body
     text only, so in v1 a request whose figures are in an attached letter is
     listed as "read the attached letter" for the founder. Reading attachments
     comes with the Data room (docs/data-room), which indexes them.
8. **A routine nudges audit season.** Creating the agent adds one inactive
   suggestion the founder can turn on: weekly from January to March, run
   `@carta-audit-response` and report new requests. The investor-update routine
   (monthly or quarterly) is offered the same way. Both use the existing `Routine`
   table and `@Skill` mentions.
9. **No new tables in v1.** Open audit requests live in Gmail threads and the
   agent's replies; Rakazo stores nothing new about investors. An audit tracker is
   a v2 decision once the skill shows what needs tracking.

## Not in v1

- Writing to Carta (issuing grants, updating stakeholders, accepting audit
  confirmations inside Carta).
- Sending without the founder's per-message approval.
- Opening or signing DocuSign envelopes (a DocuSign connection is a v2 option).
- Reading email attachments (comes with the Data room).
- Confirmation.com and other auditor portals.
- The fund (LP-side) persona and the CRM scopes.
- A cap table dashboard (the Cap Table page is the agent's chat).
- An investor CRM in Rakazo.

## Tests

- Unit: `isCartaEndpoint` (https host match, look-alike hosts rejected);
  `assignmentAllowsTool` refuses a non-listed Carta tool for the Carta spawn key
  with `allowAllTools: true`; for the Carta agent, `mail_send` still asks with an
  "Always allow" rule and with Auto Review on, and a draft-id-only send is
  refused; `ensureCartaAgent` is idempotent and narrows a wider
  assignment; `bots.create` rejects `carta-agent:`.
- Postgres: agent and assignments are scoped to space and user; another user's
  Carta server is never assigned.
- Skills: both parse with `parseSkillMd` and appear in the catalog.
- Evals (offline, synthetic fixtures only): an audit-request email with holdings
  that match Carta, one that differs, and one asking for a 409A that is not in
  Drive; a DocuSign request email with no figures, which must produce the Carta
  numbers to compare and no "sign it" verdict; an update period with a missing revenue figure that must come out TBD.
  Fixture names and numbers are invented.
- Manual: connect Carta with a real account, run each skill once, and record what
  the real `tools/list` returned.

## PR breakdown

1. Spike (no product code): sign in to Carta, record `tools/list`, schemas and the
   as-of-date answer in this file; settle `CARTA_READ_TOOLS`.
2. Contracts and agent: `carta.ts`, `ensureCartaAgent`, `carta.agent` RPC, reserved
   prefix, the MCP guard, Finance tool gate, tests.
3. Skills: `carta-investor-update`, `carta-audit-response`, evals.
4. Web: the Cap Table sidebar item and `/app/cap-table` route, routine
   suggestions, a web e2e that opens the page, and its CI screenshot.

## Open risks

- **Carta's tool surface is unknown until sign-in.** If `fetch` cannot answer
  holdings as of a past date, the audit skill falls back to current holdings plus
  the transactions after the as-of date, and says so in the draft.
- **Audit emails are sensitive.** They contain other investors' positions and
  auditors' details. Nothing from them is logged, and test fixtures are synthetic.
- **Write tools may appear in Carta's server later.** The explicit allow-list
  keeps them out until a plan adds them with approval.
- **Data room dependency.** Without the Data room (docs/data-room), documents come
  from Drive only; many companies keep their 409A and SPAs in Carta or email
  attachments, which v1 may not reach.
