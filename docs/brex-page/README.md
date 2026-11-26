# Brex page

## Summary

A space owner opens **Brex** in the sidebar and sees the company's Brex account in one place: an overview with cash, card spend and where spend goes; every card as a tile with a spend sparkline; spending, limits, people, expenses, accounts, travel, and the changes the agent made. Every change still goes through the Brex agent and its approval card, exactly as the buttons on the Brex cards integration page do today.

Mockup: [`mockup.html`](mockup.html) (real app screens with the new page built in the live page, invented data). Earlier plan this builds on: [`../brex-cards/README.md`](../brex-cards/README.md) (epic #947, merged).

## User stories

From the owner's list (all sections in v1):

1. Overview: cash, card spend this month against last month with a sparkline, active cards, limits near their cap, a "Where spend goes" Sankey (card spend, category, merchant), and top vendors.
2. Cards: a card view (tiles with name, last four, status, limit and period, owner, a used-of-limit bar and a spend sparkline) and a list view; search by name, vendor or last four; a status filter with terminated cards hidden by default; a detail panel with recent transactions and Lock, Edit limit, Cancel; a New card form.
3. Spending: card transactions filtered by merchant, card, person and date; a category breakdown; possible duplicate subscriptions.
4. Limits: spend limits with members, amount, period and usage.
5. People: each person's cards and limits; an Offboard action that asks the agent to lock or cancel their cards and remove them from limits.
6. Expenses: expenses missing a receipt or memo, with Edit memo; pending reimbursements (read only, approve in Brex) if slice 1 confirms a read for them.
7. Accounts: cash accounts with balances; statements (link to Brex, the API has no statement file).
8. Travel: upcoming trips (read only).
9. Activity: changes the agent made in Brex and the result.

## Decisions

### 1. Owner-only page, web and desktop

The page is at `/app/brex/*`, shown in the sidebar (`apps/web/src/pages/Shell.tsx`) only to a space owner whose space has Brex cards connected, the same rule as the existing `brexCards.cards` RPC (`requireSpaceOwner` in `apps/api/src/brex-cards.ts`). Members see nothing new. `brex` joins `PAGE_SEGMENTS` (`apps/web/src/lib/bootstrap-target.ts`) and the route list in `apps/web/src/App.tsx` next to `/app/finance/*`.

Electron hosts the web UI, so it gets the page. The Expo app does not get it in v1: it is an owner-only, chart-heavy page and the agent already answers the same questions in chat on mobile. This is the explicit degrade AGENTS.md asks for; a native page is a follow-up.

### 2. Data: live reads through the server's read tools, nothing new stored

Every section reads through the in-process Brex cards server's read tools, the way `brexCardsCards` calls `list_cards` today, so the token, the space scoping and the Brex client stay in one place. Each new RPC calls one fixed read tool; none takes a tool name from the client, because `callServerTool` leaves tool authorization to its caller. New owner-only RPCs in the `brexCards` namespace return what each section shows. Aggregates (totals, sparklines, Sankey flows, top vendors, near-limit, duplicates, people totals) are computed in the API from one fetch of card transactions and expenses over the last 90 days, shared by every card, so a card filter never runs after a page cap.

**Partial data.** Cards, users, limits, trips, accounts and statements keep today's `whole()` reads: an incomplete list is an error, as now. Only card transactions and expenses are capped (they already report incomplete pages). When either is incomplete, every aggregate built from it carries `partial: true` and the page shows "Partial results"; it does not claim to show "the last N", since Brex's page order is not established.

**Limit usage on cards.** The used-of-limit bar uses the card's own period: the current month for monthly cards and the current quarter for quarterly cards, both inside the 90-day fetch. Yearly and one-time cards show their limit without a bar, because older charges can fall outside the window. Spark lines always show the last 90 days and are separate from usage.

Nothing is cached in memory or on disk, so any API process can answer any request. No new table in v1. If real accounts are too slow, a Postgres snapshot refreshed by a job is the follow-up, decided with a measured number from the live check.

### 3. Fields the server must start reading

Confirmed in Brex's public OpenAPI files (transactions, expenses and budgets APIs) but not read by `packages/brex-mcp` yet:

- card transaction merchant `mcc`;
- expense `category`, `receipts`, `compliance_status`;
- spend limit `current_period_balance.amount_spent` (limit usage).

Reimbursements are not card expenses: today's `list_expenses` calls `/v1/expenses/card`. Slice 1 adds a `list_reimbursements` read only if Brex's expenses OpenAPI confirms an endpoint and filter for reimbursement expenses (scope `expenses.card` or another the token form offers); otherwise the reimbursements story is cut from v1 and the Expenses section shows only missing receipts and memos.

`list_card_transactions`, `list_expenses` and `list_spend_limits` return them, and `BrexApiEmulator` serves them with invented data so the demo and tests show every section. The agent sees the same fields, which also improves its spending answers.

Not in the API: a statement file (rows link to Brex) and a trip cost field (Travel shows dates and booker only; trip cost is cut from v1 unless the live check shows expenses carry a trip id).

### 4. Categories

The Sankey and the category breakdown group spend into six buckets: Software, Cloud, Travel, Meals, Marketing, Other. One fixed table in `packages/contracts` maps Brex's expense `category` values to a bucket, with the merchant MCC as the fallback when an expense has no category, and Other last. Transactions join expenses by `expense_id`. The mapping is one source of truth shared by the page and the agent's skills.

### 5. Charts: reuse the app's own chart code, no new dependency

The app already draws charts as SVG in `apps/web/src/components/finance/charts.tsx` (`LineChart`, `MonthBars`, `shade`, nice scales) and `Sparkline.tsx`. The Brex page uses those for bars, trends and sparklines. `Sparkline` today labels itself "Price up/down/flat" and colors a rise as success; it gains an optional accessible label and a neutral tone, so a rising spend line is not shown as good news, and existing callers keep their behavior. The Sankey is one new SVG component (three fixed columns, stacked nodes, curved ribbons, about a hundred lines) in the same style.

Observable Plot and `d3-sankey` were considered. Plot duplicates what `charts.tsx` already does, and a three-column Sankey with a fixed order does not need `d3-sankey`'s general layout. If the Sankey needs crossing reduction or more columns later, `d3-sankey` is the dependency to add.

### 6. Changes go through the agent, as today

The page never calls a Brex write. Lock, Cancel and Edit limit reuse the fixed message templates and owner checks of `BrexCardsSection`. New card, Edit memo and Offboard add templates of the same kind:

- "Create a vendor card named {name} for {merchant}, ${amount} per {month|one time}, locked to {merchant}{, lock after {date}}."
- "Set the memo of expense {expenseId} to {memo}."
- "Offboard {user}: lock their cards {ids}, cancel {ids}, remove them from limits {ids}."

Each Brex write the agent makes still needs its own approval, with the caps checked at dispatch, so Offboard asks once per write and reports what was done if some are denied. Buttons are disabled when **Allow changes** is off, and a form open when it turns off cannot send, as today. Offboard shows only the card and limit steps; turning off a Brex user is not offered.

### 7. Activity

Activity lists the `ExternalEffect` rows for the space's Brex cards server, read with the existing decoders for both direct and catalog requests (`approval-effect.ts`, never by poking into `request`) and filtered to the decoded route of the connected server. It shows tool, target card or limit, status and time. It does not show who approved: `ExternalEffect` stores no approver and the approval answer does not persist one, and recording it is a separate change. Owner only, scoped to the space.

## Slices

One PR per slice, each from `origin/main` with a failing test first, stories and `pnpm design-system` for UI, and a hand test in a demo stack with the Brex emulator.

1. **Server reads and emulator data.** Add the fields in decision 3 to `packages/brex-mcp` (`client.ts`, `server.ts`, `emulator.ts`) and the category table (decision 4) to `packages/contracts`. Seed the demo's Brex emulator with invented cards, transactions over 90 days, expenses with categories and missing receipts, limits with usage, users, trips, accounts and statements. Add `list_reimbursements` only if confirmed (decision 3). Tests: tool output includes the new fields; the mapping covers every Brex category value and falls back to MCC, then Other; a capped transaction read reports incomplete while a `whole()` read still errors.
2. **API read model.** Owner-only RPCs in `apps/api/src/brex-cards.ts`: `overview`, `cardsView` (cards with period spend and a 90-day series), `spending` (filtered transactions, categories, Sankey flows, duplicates), `limits`, `people`, `expenses`, `accounts`, `trips`, `activity`. The `partial` flag. Tests per RPC against the emulator: a member, a former owner, and a new owner using the previous owner's connection are refused as `brexCardsCards` refuses them today; totals add up; the Sankey's merchant flows sum to its category flows and to card spend; terminated cards are excluded from active counts; a capped transaction read sets `partial` on every aggregate built from it; monthly and quarterly cards get usage, while a yearly and a one-time card with spending older than 90 days get none; Activity excludes effects of another space and of another server.
3. **Page shell and Overview.** Route, sidebar row, section tabs (the Company page tab strip), the not-connected state with today's connect dialog, and Overview with the new Sankey component. Stories: Overview, Sankey (normal, one category, empty), not connected.
4. **Cards.** Card tiles and list toggle, sparklines (with the neutral tone), search and status filter (terminated hidden), detail panel with today's actions, New card form. Tests: the exact New card message, a hostile card or merchant name kept as data inside the message, and a form that cannot send after Allow changes turns off. Stories for each state, including Allow changes off.
5. **Spending, Limits, People.** Tables with the app's filter controls (`useListParams`, sortable `TableHead`, `ListControls`), category bars, the duplicate callout, limit usage, and Offboard. Tests: the exact Offboard message; with the existing executor gate fixtures (`executor-brex-cards-gates.test.ts`), no Brex write happens before approval or after a denial, and each write in an Offboard needs its own approval. The demo's scripted runtime does not drive executor tools, so the hand test checks the message and the approval card, not the Brex result.
6. **Expenses, Accounts, Travel, Activity.** Missing receipt and memo list with Edit memo (exact message test), reimbursements if slice 1 added them, accounts and statements, trips, and the activity list.

Slices 3 to 6 depend on 2; slice 2 depends on 1. Slices 4, 5 and 6 can be built in parallel after 3.

## Open questions

- Whether `current_period_balance` is filled for every spend limit type: checked in the live check; the usage bar hides when it is missing.
- How much of real card spend has an expense category: measured in the live check; the MCC fallback covers the rest.
- How long a 90-day window takes on a large real account: measured in the live check before deciding on a snapshot table.
- Whether expenses carry a trip id, which would bring back trip cost.

## Changes from the mockup

After review: Activity has no "Approved by" column; Offboard has no "Turn off Brex user" row; yearly and one-time cards show no usage bar; reimbursements depend on slice 1; partial data shows "Partial results".

## Not in this plan

Unlocking cards, moving money, full card numbers, approving reimbursements (no API), recording who approved a change, webhooks and alerts, inviting or turning off Brex users, a native mobile page.
