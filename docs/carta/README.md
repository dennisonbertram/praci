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

1. **Connection reuses the Carta tile** added on Integrations (a first-party MCP
   tile that opens the custom connection dialog prefilled with the endpoint). A
   server counts as Carta by its endpoint host, through one helper in
   `packages/contracts/src/carta.ts` (`isCartaEndpoint`), like
   `financeProviderForEndpoint`.
2. **The agent follows the Finance agent's pattern.** Spawn key
   `carta-agent:<userId>` (`cartaAgentSpawnKey`, `isCartaAgentSpawnKey`), created
   idempotently by `ensureCartaAgent` in `apps/api/src/carta-agent.ts` and exposed
   as RPC `carta.agent`. `bots.create` rejects the reserved prefix
   (`router.ts`, next to the `finance-agent:` check). Once Carta is connected, its
   card on Integrations offers "Open Carta agent", which calls `carta.agent` and
   opens the bot. No new page in v1.
3. **Carta is read-only for the agent.** `CARTA_READ_TOOLS` lists the allowed tools
   explicitly; `assignCartaServers` writes them to `BotMcpServer.allowedTools`, and
   `assignmentAllowsTool` in `mcp-connector.ts` enforces the list for this spawn key
   even when `allowAllTools` is set (the Finance agent's guard). If Rakazo's OAuth
   client can request scopes per server, request only the `read_*` scopes.
   `set_context` stays allowed because it selects a company, not data.
4. **Writing happens in Gmail and Drive, behind approval.** The agent gets the
   built-in `mail_search`, `mail_get`, `mail_draft`, `mail_send`, `drive_search`,
   `drive_read` and `drive_create_file`. Each write already pauses for the
   founder's "Allow once" (`action-approval.ts`). The skills always save a draft
   first and then ask to send it, so the approval card shows the exact message.
   An "Always allow" rule must never cover `mail_send` for this agent: the Carta
   agent asks every time, whatever rules exist. Unlike the Finance agent, this
   agent keeps the built-in Google tools; it still gets no Composio or Pipedream
   tools.
5. **It reads Finance numbers through the existing tools.** `financeToolsAllowed`
   is widened to the Carta spawn key so `finance_overview` and `finance_breakdown`
   supply cash, burn and runway. No new finance code.
6. **Two built-in skills**, added to `packages/adapters/src/builtin-skills.ts` (no
   migration):
   - `carta-investor-update`: pick the period; pull metrics from `finance_*`;
     pull ownership and new investors from Carta; read the last two sent updates
     in Gmail for structure and tone; ask the founder for highlights, lowlights
     and asks if they are not in the chat; save a Gmail draft to the founder with
     investors in Bcc. It never invents a metric: anything missing is marked TBD in
     the draft.
   - `carta-audit-response`: search Gmail for audit and confirmation requests in
     the last 120 days; for each, extract the fund, the as-of date and every item
     asked; answer holdings from Carta as of that date and flag any difference from
     the auditor's figures; find the requested documents in Drive (and the Data
     room once it exists); draft the reply with attachments listed, plus a short
     "still needed from you" list, then ask to send it. **DocuSign requests:** the
     agent cannot open or sign an envelope. It reads what the email shows (sender,
     fund, due date, any figures or attached letter), checks those against Carta,
     and tells the founder either "the figures match, sign it" or exactly what
     differs and the reply to send the auditor instead. When the email has no
     figures, it gives the founder the Carta numbers to compare inside DocuSign.
     It never signs or confirms on the founder's behalf, and never answers in a
     confirmation portal.
7. **A routine nudges audit season.** Creating the agent adds one inactive
   suggestion the founder can turn on: weekly from January to March, run
   `@carta-audit-response` and report new requests. The investor-update routine
   (monthly or quarterly) is offered the same way. Both use the existing `Routine`
   table and `@Skill` mentions.
8. **No new tables in v1.** Open audit requests live in Gmail threads and the
   agent's replies; Rakazo stores nothing new about investors. An audit tracker is
   a v2 decision once the skill shows what needs tracking.

## Not in v1

- Writing to Carta (issuing grants, updating stakeholders, accepting audit
  confirmations inside Carta).
- Sending without the founder's per-message approval.
- Opening or signing DocuSign envelopes (a DocuSign connection is a v2 option).
- Confirmation.com and other auditor portals.
- The fund (LP-side) persona and the CRM scopes.
- A Carta page or dashboard.
- An investor CRM in Rakazo.

## Tests

- Unit: `isCartaEndpoint` (https host match, look-alike hosts rejected);
  `assignmentAllowsTool` refuses a non-listed Carta tool for the Carta spawn key
  with `allowAllTools: true`; an "Always allow" rule for `mail_send` still asks
  for the Carta agent; `ensureCartaAgent` is idempotent and narrows a wider
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
4. Web: "Open Carta agent" on the Carta card, routine suggestions, e2e screenshot.

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
