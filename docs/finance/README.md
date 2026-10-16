# Finance plan

## Goal

A Finance page under Inbox in the sidebar: a dashboard of cash, burn, runway, spend,
upcoming charges and subscriptions, where every element opens a detail page, plus a
Finance agent in a side panel that can answer questions and suggest cost cuts. Data
comes from the user's Mercury and Brex accounts. Approved design:
[mockup.html](mockup.html).

Web and desktop (Electron hosts the web UI) ship first. Mobile is a follow-up: the
dashboard is dense and needs its own native layout; until then mobile shows nothing
new, which is safe because no existing workflow changes.

## Decisions

1. **Connection is the vendors' official MCP servers over OAuth**, reusing Rakazo's
   existing remote-MCP support (`McpServer`, `mcp.oauth.*`, `remote-mcp.ts`). Mercury:
   `https://mcp.mercury.com/mcp`. Brex: `https://api.brex.com/mcp` (an admin must
   enable Brex's AI-assistant beta). Both use dynamic client registration, so no
   vendor approval is needed. The empty Finance page shows "Connect Mercury" and
   "Connect Brex", which create the `McpServer` with that endpoint and start OAuth.
   A server counts as a finance source by its endpoint host, through one helper.
2. **The dashboard reads Postgres, not the vendors.** A sync calls the same MCP tools
   server-side (`callRemoteMcpTool`) and stores normalized accounts, transactions and
   Treasury yield, scoped to space and user and keyed by `mcpServerId` and the
   vendor's id. Sync is on demand from the page with a 15-minute throttle and a
   claim token on a sync-state row (the `MailSyncState` pattern), backfilling 13
   months and re-reading the last 10 days on each run so pending charges settle.
   Removing the MCP server deletes its finance rows.
3. **Read-only.** Sync and the Finance agent use read tools only. The agent's
   `BotMcpServer` assignments list the allowed read tools explicitly; the vendors'
   write tools (payments, transfers, card changes, memo edits) are not exposed.
4. **One set of pure calculations in `packages/core`**, used by the API for every
   dashboard and detail number, with unit tests on synthetic data:
   - *Cash* = Mercury checking + savings + Treasury. Brex card balance owed is shown
     separately and is not cash.
   - *Classification* of each transaction: `spend`, `revenue`, `financing`,
     `internal_transfer` (Treasury moves and moves between the user's own
     accounts), `card_payment` (Mercury payments to Brex).
   - *Spend* = Mercury `spend` + Brex card, bill and reimbursement expenses by
     purchase date. Card payments are excluded when Brex is connected, so card
     purchases are not counted twice.
   - *Monthly burn* = average of the last 3 full months of cash out minus revenue,
     excluding internal transfers and financing. *Runway* = cash / burn; run-out
     date follows from it.
   - *Recurring charges*: same normalized counterparty, at least 3 charges, regular
     interval (weekly, biweekly, monthly, annual, ±3 days), similar amounts.
     *Upcoming 30 days* = predicted recurring charges + pending transactions + Brex
     bills due. *Subscriptions* = recurring vendors, normalized to a monthly cost.
   - *Overlaps* tag: a small static vendor-group map (for example AI model and coding
     tools). ponytail: static map; let the agent judge overlap beyond it.
5. **Finance agent** follows the Inbox agent pattern: `spawnKey =
   "finance-agent:<userId>"`, created idempotently by `finance.agent`, assigned the
   user's Mercury and Brex servers with the read-only tool list. The panel is closed
   by default; "Ask agent" in the page header opens it and hides while it is open.
   The agent gets no Composio or Pipedream tools. It reads the synced rows through four
   read-only built-in tools that reuse the core calculations: `finance_overview`,
   `finance_breakdown`, `finance_transactions` and `finance_recurring`. Each shows a small
   preview card (a `finance` message block) in the chat. They are offered only to the
   owner's own direct runs when a Mercury or Brex server exists. The vendor MCP tools stay
   for details the sync lacks (receipts, memos, cards).
6. **Skills** are built-in skills in `packages/adapters/src/builtin-skills.ts`:
   `finance-cost-cutting`, `finance-runway-scenarios`, `finance-monthly-review`,
   `finance-categorize` (suggests categories; applying them is a write and is not
   offered yet).
7. **Routes** are `/app/finance` and `/app/finance/*` detail pages (accounts,
   account, burn, month, runway, spend, category, recurring, vendor, transaction,
   receipt), each with a breadcrumb back to Finance. Charts are inline SVG drawn at
   the container's width; no chart dependency.
8. **Receipts** come from Brex expense receipts and Mercury transaction attachments.
   The download link is fetched on demand through the API, because vendor links
   expire.

## Not in v1

- **Receipt upload.** The mockup shows "Upload" on a charge with no receipt. There is
  nowhere to store an uploaded file yet. Options to decide later: send it to Brex
  (`upload_card_expense_receipt_from_urls` needs a public URL, and it is a write),
  store it in a connected Google Drive, or add Rakazo file storage. v1 shows "No
  receipt" without an Upload button.
- Plaid and other banks. The sources are separate adapters, so adding one does not
  change the calculations.
- Agent awareness of the detail page the user is on.
- Write actions (categorizing, payment requests).
- Mobile screens.

## Mockup limits (fixed in the build)

- Category totals and vendor amounts in the mockup are independent placeholders; the
  build computes both from the same transactions.
- Vendors other than Vercel use a generic template; the build renders every vendor
  from its own charges.
- Per-account balance charts are scaled copies of the total; the build needs real
  balance history. Neither MCP server returns historical balances directly, so the
  build reconstructs them backwards from the current balance and transactions.
- The Week/Quarter/Year chips did not update the dashboard number; they must.
- Phone layout, light mode and the empty state were not rechecked after the
  drill-down pages were added.

## Open risks

- **Both MCP servers are beta.** Tool names and response shapes can change. Every
  mapper validates the response with zod and reports a sync error rather than writing
  bad rows. Fixtures in tests are synthetic, shaped like real responses.
- **Brex card balance owed** may not be exposed by any read tool; if not, the
  Accounts page omits that row.
- **Mercury categories are sometimes empty.** Uncategorized spend shows as
  "Uncategorized"; the categorize skill suggests fixes.
- **Live testing needs a real OAuth connection** made by the user in the running app;
  agents cannot complete vendor sign-in themselves.
