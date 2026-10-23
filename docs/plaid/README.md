# Plaid as a finance source

## Summary

A founder whose money is not (only) at Mercury or Brex connects those banks and cards once
through Plaid Link, and their balances and transactions appear on the existing Finance page.
Cash, burn, runway, spend and subscriptions are then computed over all of the company's USD
money, with Chase, Amex, Ramp, Rho, Relay or U.S. Bank next to Mercury and Brex. Plaid is one
more read-only source behind the existing Finance tables; nothing moves money, and Finance keeps
working without it. [docs/finance/README.md](../finance/README.md) lists Plaid as not in v1 of
Finance; this plan is that follow-up. Framing, Plaid facts and competitor notes were gathered
on 2026-10-21; the plan was revised after two Astra reviews (see Review record).

Web and desktop (Electron hosts the web UI) ship first. Mobile has no Finance screen
(`apps/mobile/app` has no finance route), so it shows nothing new; the Finance agent, which
reads the synced rows, already answers on mobile and will include Plaid data. Mobile keeps its
integration setup screen (`apps/mobile/app/(settings)/integration-setup.tsx`, Composio and
Pipedream only); Plaid keys are entered on the web setup page. Plaid Link on mobile is a
follow-up (see Out of scope).

## User story

From the framing (spec-like idea, confirmation step skipped on request). Each PR below traces
to one of these points:

1. **Accurate.** Today Finance shows burn and runway only for Mercury, Brex and imported
   statements. With Plaid the
   numbers cover the whole company, and the same money is never counted twice (PR B, PR C).
2. **Simpler.** One bank connection flow covers the US and Canadian institutions Plaid supports
   instead of one integration per bank (PR A, PR C, PR D).
3. **Same read-only promise** as Mercury and Brex: only Plaid's Transactions product is
   requested (every PR).

The experience when it ships: the founder opens Integrations (or Add account on Finance) and
picks the bank entry; Plaid Link opens in the page; they pick Chase, log in, pick accounts; back
in Rakazo the bank shows as connected and Finance shows the Chase accounts in Cash and their
transactions in spend, burn and runway once the initial import finishes, next to Mercury and
Brex. If Chase later requires a new login, Finance says the source needs reconnecting and one
click reopens Link in update mode. Disconnecting removes the Plaid Item (`/item/remove`) and its
synced rows.

## Assumptions (each marked)

- **A1 (Plaid docs, 2026-10-21).** The standard web Link script
  (`https://cdn.plaid.com/link/v2/stable/link-initialize.js`) takes a server-created
  `link_token`, calls `onSuccess(public_token, metadata)` and `onExit(error, metadata)`, and
  supports update mode (a link token created with `access_token`). Desktop web OAuth
  institutions open the bank in a popup from Link and need no redirect URI. Plaid does not
  document Electron.
- **A2 (Plaid docs).** `/accounts/get` is free and returns the Item's account inventory with
  cached balances; `/transactions/sync` returns `added`, `modified`, `removed`, `has_more` and
  `transactions_update_status` (`NOT_READY`, `INITIAL_UPDATE_COMPLETE`,
  `HISTORICAL_UPDATE_COMPLETE`, or unknown) behind a cursor, and its `accounts` array only
  covers accounts of the returned transactions. `transaction_id` and `account_id` are unique
  across Items. `/item/get` returns `institution_id` and `institution_name`. A public token is
  single use.
- **A3 (Plaid docs).** Duplicate Items: Plaid advises against rejecting on `institution_id`
  alone and recommends comparing the Link `metadata.accounts` (mask, name, type, subtype) with
  already connected accounts before exchanging the public token.
- **A4 (Plaid docs).** After an Item is created the first `/transactions/sync` can return no
  transactions while Plaid is still fetching; later calls return the history and
  `transactions_update_status` reports when the historical pull is complete. Reading until
  `has_more` is false, then re-reading shortly after, is the documented pattern without webhooks.
- **A5 (Plaid policy).** Client id and secret may not be shared with third parties, so each
  operator (self-hoster) brings their own keys. Sandbox is free; Production is billed per Item
  per month for Transactions, and `/item/remove` stops that billing. **The commercial
  arrangement for a hosted multi-tenant deployment on one key is TBD** (Plaid's reseller
  program describes managed end-customer teams; whether ordinary application users fall under it
  is not established).
- **A6 (code).** `cashSummary`, `cashHistory` and `cashAtDays` in
  `packages/core/src/finance/metrics.ts` sum account balances without checking currency, and
  `hasCashAccounts` in `apps/api/src/finance.ts` counts any non-card account; only transactions
  are filtered to USD (`counts`). A CAD account would add to USD cash and runway today. PR B
  fixes this for every provider.
- **A7 (code).** `hasFinanceSource` in `packages/adapters/src/finance-tools.ts` recognizes
  statement accounts and Mercury, Brex and Blockscout MCP servers; the executor uses it to
  offer the Finance tools. `financeConnect` calls `ensureFinanceAgent`. Both need Plaid.
- **A8 (repo rule).** No provider-specific environment variables: the keys go in the shared
  connection settings only. There is no `PLAID_*` env fallback.
- **A9 (code).** `financeSyncJob(userId, spaceId, availableAt?)` in
  `packages/adapter-kit/src/background-jobs.ts` already supports a delayed run, and its replace
  key merges repeats.
- **A10 (unverified, Plaid docs).** Plaid distinguishes PFC v1 and v2 category sets. The
  adapter keys only on values that exist in both (`INCOME`, `TRANSFER_IN`, `TRANSFER_OUT`,
  `LOAN_PAYMENTS`, `BANK_FEES` primaries and the `LOAN_PAYMENTS_CREDIT_CARD_PAYMENT`,
  `TRANSFER_IN_INVESTMENT_AND_RETIREMENT_FUNDS` details); fixtures use the v2 names. Whether a
  request option selects the version is settled in PR B against the API reference.
- **A11 (Plaid coverage CSV, via the coordinator).** Plaid's institution ids: Mercury
  `ins_116794`, Brex `ins_127888`. The gate confirms them with `/institutions/search`.

## Design

Decisions, with the code they rest on. Paths are repo-relative.

### 1. Operator keys live in the shared connection settings, in their own small module

The keys are a `plaid` row in `integration_provider_configs` (`IntegrationProviderConfig` in
`packages/db/prisma/schema.prisma`, id `plaid`, encrypted through the secrets store with
`recordId: "integration-provider:plaid"`, as `IntegrationProviderSettings.save` does in
`packages/adapters/src/integration-provider-settings.ts`). The contract is a new
`PlaidConfigSchema` in `packages/contracts/src/integration-settings.ts`:
`{ provider: "plaid", clientId, secret, environment: "sandbox" | "production" }`.

Plaid is **not** added to `IntegrationProviderIdSchema` / `IntegrationProviderConfigSchema`.
That enum is the list of managed connector providers: `IntegrationProviderSettings.providers()`
wraps every id in a `ConfiguredIntegrationProvider` (`catalog`, `begin`, `complete`, `proxy`),
`prepare()` builds a connector from the parsed config, and `save()` verifies by calling
`adapter.listConnectedExternalIds`. Instead:

- `packages/adapters/src/plaid-settings.ts`: `loadPlaidConfig(prisma, secrets)`,
  `savePlaidConfig(prisma, secrets, config, context)` (verifies the keys with
  `POST /institutions/get` `{ count: 1, offset: 0, country_codes: ["US"] }`, then
  `secrets.put` and `upsert`), `plaidConfigured(prisma)`. **Changing `environment` or
  `clientId` while any `finance_plaid_items` row exists is rejected** with
  `"Disconnect every bank connected through Plaid before changing the Plaid environment or
  client ID."`; saving a new secret for the same client and environment is allowed.
- RPC stays `integrationSetup.get` / `integrationSetup.save`. `save`'s input becomes
  `IntegrationSetupSaveInputSchema = z.discriminatedUnion("provider",
  [...IntegrationProviderConfigSchema.options, PlaidConfigSchema])`; the router branches on
  `input.provider === "plaid"`, owner-only like the others (`isDeploymentOwner`). `get` lists
  `plaid` in `providers` for owners; the id type becomes `IntegrationSetupProviderIdSchema =
  z.enum([...IntegrationProviderIdSchema.options, "plaid"])`. The mobile setup screen keeps its
  fixed Composio/Pipedream list and finds providers by id, so the extra entry is ignored there.
- **Availability for everyone:** `integrationSetup.get` returns `providers: []` to non-owners
  (`apps/api/src/router.ts`, `integrationSetup.get`), so the connect entry points do not read
  it. `FinanceOverview` gains `plaidAvailable: z.boolean().optional()` (keys are configured);
  credentials stay owner-only.

### 2. Data model: an Item row and a second nullable key on the finance rows

Mercury and Brex rows hang off `McpServer` through `mcpServerId` (cascade delete; sync state
in `FinanceSyncState`). Statement rows use `mcpServerId NULL` with partial unique indexes
(`packages/db/prisma/migrations/20261019130000_finance_statements/migration.sql`); exchanges
have their own table (`FinanceExchangeConnection` with `secretId`). Plaid needs an owner row (a
token to delete, a cursor, a sync state, something to cascade from) *and* rows in
`finance_accounts` / `finance_transactions`, because every calculation reads those tables
(`loadAccounts`, `loadTransactions` in `apps/api/src/finance.ts`). One migration, in PR A:

- `FinancePlaidItem` (`finance_plaid_items`): `id`, `spaceId`, `userId`, `itemId` (Plaid's,
  `@unique`), `institutionId`, `institutionName`, `secretId` (a `Secret` row of kind `plaid`
  holding the access token, encrypted like the exchange key in `exchange-sync.ts`), `cursor`
  (null until the first complete read), `lastSyncedAt`, `syncStartedAt`, `claimToken`,
  `lastErrorAt`, `lastError`, `needsReconnect`, `importStatus` (`pending` | `complete` |
  `stalled`), `importRuns`, `createdAt`, `updatedAt`; `@@index([spaceId, userId])`. The
  sync-state columns are the `FinanceSyncState` columns on the item row, so there is one row
  per Item and one claim query.
- `FinanceAccount` and `FinanceTransaction` get `plaidItemId String?` with a relation to
  `FinancePlaidItem` (`onDelete: Cascade`) and `@@unique([plaidItemId, externalId])`, mirroring
  `mcpServerId`. A Plaid row has `mcpServerId NULL`, `plaidItemId` set, `provider = "plaid"`.
  Removing the item deletes its rows by foreign key. Writes use
  `ON CONFLICT ("plaidItemId", "externalId")`.
- `FinanceAccount` also gets `balanceKnownAt DateTime?` (Design item 5); the migration
  backfills it from `updatedAt` for existing rows.

Every query is scoped by `spaceId` and `userId` through `actorScope`. All state is in
Postgres, so any API or worker process can serve the next request.

### 3. `plaid` is a record provider and a source, not a `FinanceProvider`

`FinanceProviderSchema` (`packages/contracts/src/finance.ts`) drives `FINANCE_MCP_ENDPOINTS` and
`FINANCE_READ_TOOLS` through `satisfies Record<FinanceProvider, …>`, `financeProviderForEndpoint`,
the server map in `syncFinanceForUser`, `financeConnect`, and the web `FINANCE_PROVIDERS` tiles.
Plaid has no MCP server, so it joins:

- `FinanceRecordProviderSchema` (rows): `["mercury", "brex", "statement", "plaid"]`.
- `FinanceSourceSchema` (status rows in `FinanceOverview.sources`): `provider` becomes
  `FinanceSourceProviderSchema = z.enum([...FinanceProviderSchema.options, "plaid"])`, with
  optional `itemId`, `name` (institution) and `importing: z.boolean().optional()`. Mercury and
  Brex entries are unchanged; one entry per Plaid Item follows them, `serverId: null`, status
  `ok | needs_reconnect | error` (never `not_connected`). `financeSources` in
  `apps/api/src/finance.ts` builds them from `finance_plaid_items` and includes them in
  `syncDue` and `lastSyncedAt`.
- `FinanceAccountSchema` gains `balanceKnownAt: IsoDate.nullable().optional()`.
- The consumers change in the same PR as the schema (PR B): `providerName` in
  `apps/web/src/pages/Finance.tsx` becomes `sourceName(source)` (`source.name` for Plaid), the
  reconnect banner's React key becomes `source.itemId ?? source.provider`, and
  `FinanceTransaction.tsx`'s provider fallback uses the account label. `FinanceSection`'s
  `FINANCE_PROVIDERS` loop ignores Plaid entries until PR D adds the bank entry.

### 4. Link runs in the page with the standard web script

- `finance.plaidLinkToken({ itemId? })` creates the link token server-side (`products:
  ["transactions"]`, `transactions.days_requested: 395` to match the 13-month backfill,
  `country_codes: ["US", "CA"]`, `user.client_user_id = userId`, `language: "en"`; with
  `itemId`: the Item's `access_token`, which is update mode) and returns `{ linkToken }`.
  Nothing is stored for a session: the token is single use and bound to the operator's keys.
- The web client loads the script once (`apps/web/src/lib/plaid-link.ts`: inject
  `<script src="https://cdn.plaid.com/link/v2/stable/link-initialize.js">`, resolve on load,
  then `window.Plaid.create({ token, onSuccess, onExit }).open()`). There is no CSP on the web
  app (`apps/web/index.html` and `vite.config.ts` set none; the other CSPs in the repo cover
  separate documents such as the desktop auth and setup windows, sandboxes and downloads), so no
  header change.
- `onSuccess(publicToken, metadata)` calls the authenticated `finance.plaidExchange({
  publicToken, institution: { id, name }, accounts: [{ mask, name, type, subtype }] })` (new
  connection) or `finance.plaidUpdated({ itemId })` (update mode: no exchange). `onExit`
  with an error shows `"Could not connect. Try again."`; without one (the user closed Link)
  shows nothing. A cancelled update-mode Link leaves `needsReconnect` as it was.
- `plaidExchange`, in one Postgres transaction serialized per space and user with
  `pg_advisory_xact_lock(hashtext('finance-plaid:<spaceId>:<userId>'))` (the pattern in
  `finance-statements.ts`):
  1. **Overlap check before any Plaid call** (Design item 6): the selected accounts (mask +
     kind derived from type/subtype) against the user's stored `finance_accounts` of every
     provider (`lastFour` + `kind`). A match refuses with `"These accounts are already
     connected."` and no Item is created.
  2. `/item/public_token/exchange`, `/item/get`, `/accounts/get`.
  3. Insert the Item, its encrypted token (`persistPreparedSecret`, as `connectExchange`
     does) **and its accounts with balances** in the same transaction, so a second exchange,
     concurrent or seconds later, sees them in step 1.
  4. `ensureFinanceAgent`, then enqueue `financeSyncJob(userId, spaceId)` for transactions.
- **Recovery.** A database failure after step 2 calls `/item/remove` with the new token before
  the error is returned (best effort, logged), so a billable Item is not left behind invisible.
  A retried or duplicate `onSuccess` after the first request **committed** finds the stored
  accounts in step 1 and is refused with `"These accounts are already connected."` before any
  Plaid call. After the first request **rolled back**, the retry re-exchanges a single-use token
  and fails at Plaid with `INVALID_PUBLIC_TOKEN`; the client shows `"Could not connect. Try
  again."`. Either way the client re-reads the overview. There is no time-based guess.

**Electron.** The main window's `setWindowOpenHandler` (`apps/desktop/src/main.ts`,
`shouldOpenInAppPopup` in `apps/desktop/src/window-open.ts`) allows an https popup only when
its frame name is in `OAUTH_POPUP_NAMES`; everything else goes to the system browser. Link's
iframe opens an OAuth bank in a popup whose name is not ours, so that popup may be sent to the
system browser and never return to Link. The gate proves on the desktop build: (a) the Link
script and iframe load in the app window, (b) the Platypus OAuth bank's popup opens and
completes back into Link, (c) `onSuccess` fires. The pre-planned conditional change, if (b)
fails, is a follow-up PR owned by whoever runs the gate (the maintainer), filed from the gate
issue: allow in `shouldOpenInAppPopup` an https popup whose `referrer` origin is
`https://cdn.plaid.com` (Electron passes `referrer` in the window-open details), with the same
`oauthPopupWindowOptions`, plus a `window-open.test.ts` case. It is not a dependency of PR D.

### 5. Sync: `/accounts/get` for inventory and balances, `/transactions/sync` for transactions

`packages/adapters/src/plaid-sync.ts`, `syncPlaidItems(deps, scope, opts)`, runs next to
`syncFinanceForUser` (job handler, `financeRefresh`), never inside it: it needs the secrets
store and `fetch`, not an MCP tool caller.

- Claim and throttle: the same conditional `UPDATE … RETURNING` as `syncServer` in
  `finance-sync.ts` (15-minute throttle, 1-minute back-off after a failure, 2-minute stale
  claim, claim token rechecked `FOR UPDATE` in the write transaction) on `finance_plaid_items`.
  The throttle does not apply while `importStatus = 'pending'` (Design item 7).
- Read, per Item: `/accounts/get` (inventory and cached balances, A2), then page
  `/transactions/sync` (`count: 500`) from the stored cursor until `has_more` is false, keeping
  the last page's `transactions_update_status`. On
  `TRANSACTIONS_SYNC_MUTATION_DURING_PAGINATION` restart once from the stored cursor. Deadline
  100 s like `DEADLINE_MS`. The sync response's own `accounts` array is ignored.
- Write, in one transaction after the full read: upsert the inventory's accounts; delete the
  Item's stored accounts missing from the inventory (closed or deselected); upsert
  `added` + `modified`; delete `removed` (a pending charge that posted comes back under its own
  id and the pending one is in `removed`, so pending settlement needs no extra window); store
  the cursor; set `lastSyncedAt`, clear the error fields; update `importStatus`. A failed page
  leaves rows and cursor unchanged. Then `reclassifyFinance` (Design item 6) when anything was
  stored.
- **Balance contract.** `balances.current` from `/accounts/get`. **Every discovered account of a
  supported type (depository and credit) is stored.** When `current` is a number: `balanceCents = current × 100` (Plaid's sign: on a
  credit account a positive value is the amount owed, a negative value is a credit balance and
  keeps its sign; `cardOwedCents` sums it as is) and `balanceKnownAt = now`. When `current` is
  null: a new account is stored with `balanceCents = 0` and `balanceKnownAt = null`
  (unknown); an existing account keeps its last `balanceCents` and `balanceKnownAt` (stale).
  `cashSummary`, `cashHistory`, `cashAtDays` and `hasCashAccounts` exclude accounts with
  `balanceKnownAt === null`; the Accounts page shows `Balance unavailable` for them and `as of
  <date>` next to a balance whose `balanceKnownAt` is more than a day old. Mercury, Brex and
  statement writes set `balanceKnownAt = now`.
- **USD only, everywhere cash is summed.** Transactions keep their currency in the mapping
  (`iso_currency_code ?? unofficial_currency_code`) and are already excluded from totals by
  `counts`. For accounts, one predicate `countsAsCash(a)` in `metrics.ts` (`a.kind !== "card"`,
  `a.currency === "USD"`, `balanceKnownAt !== null`) is used by `cashSummary`, `cashHistory`,
  `cashAtDays` and by `hasCashAccounts` in `apps/api/src/finance.ts`, so a CAD account never
  enters cash, the balance chart or runway eligibility; it is still listed with its currency
  code on the Accounts page. This applies to every provider.
- Errors, through one `plaidFailureReason`: `ITEM_LOGIN_REQUIRED`, `PENDING_DISCONNECT`,
  `USER_PERMISSION_REVOKED`, `ACCESS_NOT_GRANTED`, `INVALID_ACCESS_TOKEN` → `needsReconnect =
  true`, `lastError = "Sign-in expired"`; `RATE_LIMIT_EXCEEDED` and timeouts →
  `"The request timed out"`; anything else → `"The request failed"`. Never the vendor's
  message, never a token.

Mapping (Plaid field → Rakazo field):

| Rakazo | Plaid |
| --- | --- |
| account `externalId` | `account_id` |
| account `kind` | `type: depository` + subtype `checking` / `paypal` / `cash management` → `checking`; subtype `savings` / `money market` / `cd` → `savings`; `type: credit` → `card`; `investment`, `loan`, `brokerage`, `other` → skipped |
| account `balanceCents`, `balanceKnownAt`, `currency` | Design item 5; `balances.iso_currency_code ?? unofficial_currency_code` |
| account `name`, `lastFour` | `name` (or `official_name`), `mask` |
| transaction `externalId`, `accountExternalId` | `transaction_id`, `account_id` |
| `postedAt`, `purchasedAt` | `date`, `authorized_date` (null when absent) |
| `amountCents`, `currency` | `-amount` × 100 (Plaid: positive means money out); `iso_currency_code ?? unofficial_currency_code` |
| `counterparty` | `merchant_name ?? name` |
| `vendorKey` | `vendorKey(counterparty)` from `@rakazo/core` |
| `category` | `personal_finance_category.primary`, lower-cased with `_` → `-` |
| `kind` | `personal_finance_category.detailed` |
| `status` | `pending ? "pending" : "posted"` |
| `cardLastFour` | the account's `mask` when the account is a `card`, else null |
| `cardholder`, `memo`, `dashboardUrl` | null; `hasReceipt` false |

Treasury yield and bills do not apply. `financeReceiptUrl` already answers not found for a row
without `mcpServerId`. `financeAccountDetail` filters transactions by `mcpServerId` (null for
Plaid) and `accountExternalId`, which is unique across Plaid Items, so account pages work as
they do for statement accounts.

### 6. Classification and overlapping feeds

`classify` in `packages/core/src/finance/metrics.ts` changes in two places; everything else
stays. `FinanceRawTxn` gains `accountKind` (loaded once per reclassify) and `ClassifyContext`
replaces `brexConnected` with `cardSources: string[]`: the vendor keys of connected card
sources, `["brex"]` when Brex has synced (unchanged behaviour), plus the institution name of
every Plaid Item that has a `card` account. `ownAccountNames` keeps its Mercury meaning and
gains `ownAccountLastFours: string[]` (the `lastFour` of every stored account of the user, any
provider).

- **Card payments, across providers.** The existing Brex rule becomes the card-source rule: a
  money-out row whose category is a credit or loan payment (Mercury slug `credit-loan-payments`
  or `uncategorized`; Plaid detailed `LOAN_PAYMENTS_CREDIT_CARD_PAYMENT`; a statement line) and
  whose vendor key matches one of `ctx.cardSources` is `card_payment`. For Brex this is the
  rule that exists today (`vendor === "brex"`), so the current metrics tests stay green. A
  Mercury repayment to an Amex connected through Plaid becomes `card_payment` while the Amex
  charges are synced, and stays `spend` when it is not. An unrelated loan payment stays
  `spend`.
- **Plaid rows** (`raw.provider === "plaid"`, `raw.kind` = detailed, `raw.category` = primary):
  on a **card account**, money in with `LOAN_PAYMENTS_CREDIT_CARD_PAYMENT` or a `TRANSFER_IN`
  primary → `internal_transfer` (a payment received on the card is never revenue), other money
  in → `spend` (a refund reduces spend). `INCOME` → `revenue`.
  `TRANSFER_IN_INVESTMENT_AND_RETIREMENT_FUNDS`, or a `TRANSFER_IN` whose counterparty matches
  `FINANCING_CATEGORY` words → `financing`. A `TRANSFER_IN` / `TRANSFER_OUT` row is
  `internal_transfer` **only when the counterparty identifies one of the user's own accounts**:
  its text contains one of `ctx.ownAccountLastFours` (Plaid and most banks print the target's
  last four in transfer descriptions) or its vendor key matches `ctx.ownAccountNames` (the
  existing Mercury rule). Otherwise the default: money out → `spend`, money in → `revenue`.
  Everything else: the existing default.
- **Known limitation (follow-up).** A transfer between two of the founder's accounts whose
  description carries no account identifier is counted on both sides (spend out, revenue in).
  No amount-and-date pairing is attempted: it could hide unrelated money. The Finance agent's
  instructions already tell it to leave own-account transfers out when it sees them.

**Overlapping feeds are refused at the account level, never counted twice.**

- *Plaid after anything:* the check in Design item 4 step 1 compares the selected accounts'
  mask + kind with every stored account of the user (Plaid, Mercury via its `lastFour`,
  statement accounts). Distinct logins or distinct accounts at the same institution are
  allowed. Adding accounts to an existing Item is a follow-up (Out of scope), so a founder who
  wants more accounts of a connected bank disconnects and reconnects it.
- *Brex through Plaid:* Brex's adapter produces no card account and no mask
  (`createBrexFinanceSource` in `brex-finance-source.ts` attributes expenses to synthetic
  account ids), so an account-level comparison is impossible. While an enabled Brex MCP server
  exists, a Plaid Item whose `institution_id` is Brex (`ins_127888`, A11) is refused in step 1
  with `"Brex is already connected directly."`. This is the one institution-level rule, with
  that reason.
- *Direct after Plaid:* `financeConnect` for Mercury or Brex refuses while a Plaid Item with
  that provider's institution id (`ins_116794`, `ins_127888`) exists: `"<Bank> is connected
  through Plaid. Disconnect that bank to connect <Bank> directly."`. Direct OAuth reveals no
  accounts before sign-in, so the institution is the only thing known at that point. The
  constants live in `packages/contracts/src/finance.ts` as `DIRECT_FEED_INSTITUTIONS`.

The founder chooses which feed to keep by disconnecting the other; nothing is deleted on their
behalf, and neither feed is declared better.

### 7. Initial import and refresh, without webhooks

Webhooks are out of this delivery (Out of scope). Sync runs on the existing triggers:
`financeOverview` enqueues `financeSyncJob` when a source is older than 15 minutes (`syncDue`),
and Refresh forces it. For a new Item (`importStatus = 'pending'`):

- `plaidExchange` stores the accounts and enqueues the job at once. While pending, the Item
  skips the throttle, and after each run the sync enqueues `financeSyncJob(userId, spaceId,
  now + 30 s)` (A9), up to 10 runs (`importRuns`).
- `importStatus` becomes `complete` when a run ends with `transactions_update_status =
  HISTORICAL_UPDATE_COMPLETE` (A2, A4), never from a non-empty page alone. After the tenth run
  without it, `importStatus` becomes `stalled`: the normal throttle resumes, the source row shows
  `importing: false` and `lastError = "History is still loading"` (status `error`). `FinanceSourceSchema` gains
  an optional `lastError`, and the Finance source line shows it next to the source name (PR B);
  today the UI shows only a status dot. Any later run that reports `HISTORICAL_UPDATE_COMPLETE`
  sets `complete` and clears it. Stalled is distinct from complete, and the source line says
  history is still loading; burn and runway are otherwise unchanged.
- The source row carries `importing: true` while pending; the Finance page re-reads the
  overview every 10 seconds while any source is importing (PR D) and shows the source as
  importing.

### 8. Update mode and disconnect

`plaidLinkToken({ itemId })` is the one path for repairing a connection (Design item 4).
`plaidUpdated({ itemId })` clears `needsReconnect` and `lastError`, sets `importStatus` to
`pending` with `importRuns = 0` so the next runs skip the throttle, and enqueues the sync.
`plaidRemove({ itemId })` calls `/item/remove` first; on success, or on `ITEM_NOT_FOUND` /
`INVALID_ACCESS_TOKEN`, it deletes the item row (foreign keys delete its accounts and
transactions) and the `Secret` row in one transaction, then reclassifies. On any other Plaid
error the row stays and the call fails with `"Could not disconnect. Try again."`.

### 9. Finance agent

`hasFinanceSource` also returns true when a `finance_plaid_items` row exists, so a Plaid-only
user gets the Finance tools; `plaidExchange` calls `ensureFinanceAgent` like `financeConnect`;
the agent's instructions in `apps/api/src/finance-agent.ts` list "banks and cards connected
through Plaid" with the other sources. The agent's built-in tools read the synced rows and so
include Plaid; there is no MCP server to assign.

### 10. Surfaces

Connect, reconnect and disconnect only, hosted in existing surfaces.

- **Integrations, Finance group** (`FinanceSection.tsx`): **one** `Bank account` tile. With no
  Item: `Connect`. With Items: the tile lists each institution on its own line (name, status
  badge, and a per-line menu with `Reconnect` when needed and `Disconnect`), plus `Open
  Finance` and a tile menu with `Connect another bank`. The tile is shown when
  `plaidAvailable`; deployment owners without keys see it with `Set up` to
  `/integrations/setup`; others do not see it. The tile uses `AppLogo`'s text fallback.
- **Add account dialog** (`components/finance/AddAccountDialog.tsx`): an `Other bank` option
  card in the Bank group after Mercury and Brex, shown when `plaidAvailable`.
- **Finance page** (`pages/Finance.tsx`): the source line lists institution names; a source
  that is importing reads `<Bank> · importing…`; the needs-reconnect banner (per Item, key
  `itemId`) opens Link in update mode directly for Plaid sources instead of linking to
  Integrations. The `Add account` header link shows whenever `plaidAvailable`, not only when a
  direct provider is missing.
- **Accounts page**: non-USD accounts show their currency code next to the balance; unknown
  balances read `Balance unavailable`; stale ones add `as of <date>`; the empty line reads
  `Connect a bank or upload a statement, with Add account.` Card payments are not in Spend
  (`financeSpend` lists `spend` rows only); they are seen on the account page and the
  transaction page, labelled `Card payment · not spend` by `categoryLabel` in
  `components/finance/ui.tsx`.

### 11. Demo and tests without keys

`packages/adapters/src/plaid-fake.ts`, `fakePlaid(options)`, is a `fetch`-level fake of
`/institutions/get`, `/link/token/create`, `/item/public_token/exchange`, `/item/get`,
`/accounts/get`, `/transactions/sync` (cursor paging; `NOT_READY` with an empty page first,
then history with `HISTORICAL_UPDATE_COMPLETE`; `removed` on pending-to-posted; a null
balance on demand) and `/item/remove`, over invented institutions and rows, in the style of
`rpc-crypto-fake-fetch.ts` and `finance-fake-tools.ts`. It accepts public tokens of the form
`public-fake-<institution>` once each (a second exchange answers `INVALID_PUBLIC_TOKEN`) and
exposes `resetLogin(itemId)`, `failNext(code)` and recorded `calls`.

The seam is `plaidFetch?: typeof fetch` on `createApp` (next to `cryptoFetch`), passed to
`FinanceDeps` and the job handlers (API and `apps/worker`); `createEmulatedApp` defaults it to
`fakePlaid().fetch` and stores fake keys through `savePlaidConfig` once the app is up, so the
e2e harness and `pnpm demo:up` run Plaid offline with keys in place. The demo seeds one
connected Item ("Chase (Mock)": a USD checking account, a CAD savings account, and a credit
card with canned charges including a card payment paid from the checking account, a merchant
refund, and a transfer to the Mercury checking account whose description carries Mercury's
last four). The demo founder is the first sign-up and therefore the deployment owner
(`packages/db/src/bootstrap-user.ts`), so the setup page is reachable in the demo; e2e users
are not owners, and the e2e connects as a non-owner on purpose.

In the browser, the e2e intercepts the CDN script URL and serves
`apps/web/e2e/fixtures/plaid-link-stub.js`, a `window.Plaid.create` stub whose `open()` calls
`onSuccess("public-fake-<institution>", metadata)` (or `onExit` for the cancel case). That
proves Rakazo's workflow; bank selection, OAuth, cancellation inside Link and update mode are
proven only in the Sandbox gate.

### 12. Security

Access tokens and the operator secret are only in the configured secrets store (the local
encrypted store, AES-256-GCM with AAD by record id, or Infisical when `SECRET_STORE` selects it), loaded on use, never returned by an RPC or logged. Link tokens are single use and bound to
the operator's keys; exchange, update and remove are authenticated and scoped to the actor.
Plaid is read-only by product choice. Every row is scoped to space and user.

## Dependencies

No new dependency.

- **HTTP to Plaid:** global `fetch`, JSON bodies with `client_id` and `secret`, base URL by
  environment (`https://sandbox.plaid.com`, `https://production.plaid.com`), responses validated
  with `zod` (already in `packages/adapters` and `packages/contracts`), in
  `packages/adapters/src/plaid-client.ts`. **Not added:** the `plaid` npm SDK (49.x, frequent
  majors, bundled Axios): eight endpoints do not justify it, and a fetch seam is how every other
  offline fake in this repo works.
- **Link:** the standard web script from `cdn.plaid.com`, loaded at runtime (Design item 4).
  **Not added:** `react-plaid-link` (a thin wrapper over the same script).
- **Routes:** none new.

## Pull requests

Four implementation PRs, each mergeable on its prerequisites only, with its own tests and demo
hand test, then the Sandbox gate. Files that more than one PR edits are listed under the PR
that edits them last; the later PR re-reads those lines after rebasing.

**Verification commands** (from the repository root). Unit and component tests:
`pnpm vitest run <files>`. `*.postgres.test.ts` files skip themselves unless `VERIFY_DATABASE=1`
and `DATABASE_URL` are set: run `pnpm test:integration`. End-to-end:
`pnpm test:e2e --spec=e2e/<name>.spec.ts`. Stories: `pnpm design-system` after adding or
changing a component, `pnpm design-system:check`, and in `apps/web` `build-storybook` then
`node .storybook/smoke.mjs storybook-static <filter>`, where `<filter>` matches the story's
import path (one run per file). After copy changes: `pnpm --filter @rakazo/web intl:extract`.
Never run the desktop Electron suite locally.

**Hand test starting state.** From the PR's worktree: `DEMO_SLOT=<n> pnpm demo:up` (a free
slot), use the behavior through the web UI or real HTTP as the seeded founder, look at the
result, then `DEMO_SLOT=<n> pnpm demo:down`. The PR says what was exercised and what the demo
cannot provide (real Link and Plaid behavior, which the gate covers).

### PR A. Keys, storage, client and fake

- **Scope.** Plaid keys on the setup page, the Item migration, the HTTP client, the offline
  fake, the `plaidFetch` seam. Nothing reads or shows Plaid data yet. (Simpler.)
- **Prerequisites.** None.
- **Files.** `packages/contracts/src/integration-settings.ts`; `packages/contracts/src/rpc.ts`
  and `apps/api/src/router.ts` (`integrationSetup`); `packages/db/prisma/schema.prisma` +
  migration `<ts>_finance_plaid` (`FinancePlaidItem`, `plaidItemId` on accounts and
  transactions, `balanceKnownAt` with backfill); `packages/adapters/src/plaid-client.ts`,
  `plaid-settings.ts`, `plaid-fake.ts`, `index.ts`; `apps/api/src/app.ts`,
  `apps/worker/src/index.ts`, `apps/api/src/finance.ts` (`FinanceDeps.plaidFetch` only),
  `packages/adapters/src/background-job-handlers.ts` (`plaidFetch` dep only),
  `packages/testkit/src/cli/emulated-app.ts` (seam default and fake keys);
  `apps/web/src/components/integrations/IntegrationSetup.tsx` (+
  `apps/web/src/pages/IntegrationSetup.test.tsx`, `IntegrationSetup.stories.tsx`).
- **Behavior.** Design items 1, 2 and 11's seam. Setup page copy: choice `Banks and cards
  through Plaid` with detail `Your own Plaid keys, for Chase, Amex and most US and Canadian
  banks` (each choice names what it brings; this one says which banks it reaches), inputs
  `Client ID` and `Secret`, select `Environment` with `Sandbox` and `Production`; the
  environment/client-id guard message from Design item 1. Non-owners see the existing "Ask
  the server owner" line.
- **Acceptance (tests first).** `plaid-client.test.ts`: base URL per environment, credentials
  in the body, a Plaid error body becomes `PlaidError` with its code, non-JSON throws.
  `plaid-settings.test.ts`: save verifies then stores; a rejected key stores nothing; an
  environment or client-id change with an Item row is rejected, a secret rotation is not;
  `loadPlaidConfig` round-trips. `plaid-fake.test.ts`: a public token exchanges once and then
  answers `INVALID_PUBLIC_TOKEN`; cursor paging; `NOT_READY` then
  `HISTORICAL_UPDATE_COMPLETE`. `router.test.ts`: owner saves `plaid`; non-owner is
  `FORBIDDEN`; `get` lists `plaid` for owners and nothing for others.
  `IntegrationSetup.test.tsx`: the choice renders; Save sends `{ provider: "plaid", … }`. A
  migration test in `packages/db/src/finance-plaid-migration.postgres.test.ts` (like
  `carta-migration.postgres.test.ts`): existing accounts get `balanceKnownAt = updatedAt`.
- **Verify.** `pnpm --filter @rakazo/db migrate:dev` (name `finance_plaid`); `pnpm vitest run packages/adapters/src/plaid-client.test.ts packages/adapters/src/plaid-settings.test.ts packages/adapters/src/plaid-fake.test.ts apps/api/src/router.test.ts apps/web/src/pages/IntegrationSetup.test.tsx`;
  `pnpm test:integration`; `pnpm design-system:check`.
- **Hand test.** Demo: `/integrations/setup` shows Plaid configured (the emulated app stored
  fake keys); replace the secret and save; switch the environment and save (allowed: no Item
  yet); save an empty secret and see the validation error.
- **Stories.** `IntegrationSetup.stories.tsx` (Plaid choice, unconfigured and configured). Run
  `pnpm design-system`.
- **Mobile.** The mobile setup screen keeps its Composio/Pipedream list and ignores the `plaid`
  entry.

### PR B. Ingestion and accounting

- **Scope.** The sync (inventory, balances contract, cursor, initial-import retries, mapping),
  classification, USD-only cash, the source rows and their consumers, agent source detection,
  the demo Item. Items are created only by the seed and tests. (Accurate.)
- **Prerequisites.** PR A.
- **Files.** `packages/contracts/src/finance.ts` (record provider, source schema,
  `plaidAvailable`, `balanceKnownAt`, `DIRECT_FEED_INSTITUTIONS`); `packages/core/src/finance/
  types.ts` and `metrics.ts` (`cardSources`, `ownAccountLastFours`, `accountKind`, Plaid rules,
  `countsAsCash`); `packages/adapters/src/plaid-sync.ts`, `finance-sync.ts`
  (`reclassifyFinance`, context loading, `balanceKnownAt` on Mercury/Brex writes),
  `finance-tools.ts` (`hasFinanceSource`), `background-job-handlers.ts` (`finance.sync` calls
  `syncPlaidItems`), `plaid-fake.ts` (sync fixtures); `apps/api/src/finance.ts`
  (`financeSources`, `financeRefresh`, `plaidAvailable`, `hasCashAccounts`),
  `apps/api/src/finance-statements.ts` (`balanceKnownAt` on import); `apps/web/src/pages/
  Finance.tsx` (`sourceName`, banner key), `apps/web/src/pages/finance/FinanceTransaction.tsx`
  (fallback label) and `FinanceAccounts.tsx` (currency code, `Balance unavailable`, `as of`,
  empty line) with tests and stories; `apps/web/e2e/fixtures/finance.ts` (a Plaid source);
  `packages/testkit/src/cli/demo/data.ts` (`demoPlaid()`), `demo/seed.ts`.
- **Behavior.** Design items 3, 5, 6 (rules), 7 and 9's `hasFinanceSource`.
- **Acceptance (tests first).**
  - `metrics.test.ts` (real `classify`): a Mercury repayment to an Amex connected through Plaid
    is `card_payment` and the Amex charges are `spend` (the cross-provider case); the same
    repayment is `spend` when no Amex card is connected; the Brex case is unchanged; a Plaid
    merchant refund reduces spend; an unrelated loan payment stays `spend`; a payment received
    on a Plaid card is internal; loan proceeds are `financing`; a transfer whose description
    carries another own account's last four is internal, one without is not; `countsAsCash`
    excludes CAD, card and unknown-balance accounts in `cashSummary`, `cashHistory` and
    `cashAtDays`.
  - `plaid-sync.test.ts` (Prisma stand-in): mapping of a canned response (signs, cents, kinds,
    skipped types, pending status, credit sign, transaction currency); inventory from
    `/accounts/get` and an account with no transactions kept with its balance after empty and
    paginated sync answers; a new account with a null balance is stored unknown and an existing
    one keeps its stale balance; the cursor stored only with the rows; a failed page leaves rows
    and cursor unchanged; restart on the mutation error; `ITEM_LOGIN_REQUIRED` sets
    `needsReconnect`; throttle skip without a Plaid call; pending import skips the throttle,
    re-enqueues with `availableAt`, completes only on `HISTORICAL_UPDATE_COMPLETE` (delayed
    history lands), and becomes `stalled` after ten runs without it.
  - `plaid-sync.postgres.test.ts` **with the real `classify`**: first run writes accounts and
    rows; second applies `modified` and `removed` and a pending-to-posted charge counts once; a
    deselected account is deleted; another user's and another space's rows are untouched; the
    Plaid side of a transfer from Mercury is internal when its description names the Mercury
    account's last four; the Mercury side follows the existing Mercury rules, unchanged.
  - `finance.test.ts` (API): `financeSources` maps `needsReconnect`, `importing` and `stalled`;
    `financeRefresh` forces `syncPlaidItems`; `plaidAvailable` false without keys;
    `hasCashAccounts` false with only a CAD account.
  - `finance-tools.test.ts`: `hasFinanceSource` true for a Plaid-only user.
  - `Finance.test.tsx`: a Plaid source shows its name on the source line and the banner, and
    two Plaid banners render without a key collision. `FinanceAccounts.test.tsx`: CAD code,
    `Balance unavailable`, `as of`.
- **Verify.** `pnpm vitest run packages/core/src/finance/metrics.test.ts packages/adapters/src/plaid-sync.test.ts packages/adapters/src/finance-tools.test.ts apps/api/src/finance.test.ts apps/web/src/pages/Finance.test.tsx apps/web/src/pages/finance/FinanceAccounts.test.tsx`;
  `pnpm test:integration`; `pnpm design-system:check`.
- **Hand test.** Demo as seeded: Finance shows the mock Chase checking in Cash; Accounts shows
  the CAD savings with `CAD` and not in Cash, and the card owed; Spend lists Chase charges next
  to Mercury and Brex and the refund reduces the total; open the Chase checking account page
  and see the card payment labelled `Card payment · not spend` and the Mercury transfer
  labelled `Transfer · not spend`; Refresh re-syncs without duplicates.
- **Stories.** `Finance.stories.tsx` (a Plaid source on the line and in the banner),
  `FinanceAccounts.stories.tsx` (CAD, unavailable and stale balances). Run `pnpm design-system`.
- **Mobile.** No Finance screen; the Finance agent's answers now include the Plaid rows.

### PR C. Backend connection lifecycle

- **Scope.** Link token, exchange with the serialized overlap check and account insert, update
  mode, remove, agent creation and recovery, verified over real HTTP against the offline stack.
  (Simpler and accurate.)
- **Prerequisites.** PR B.
- **Files.** `packages/contracts/src/finance.ts` (`FinancePlaidLinkTokenInputSchema` /
  output `{ linkToken }`, `FinancePlaidExchangeInputSchema` / output `{ itemId, name }`,
  `FinancePlaidUpdatedInputSchema`, `FinancePlaidRemoveInputSchema`);
  `packages/adapters/src/plaid-link.ts` (`createPlaidLinkToken`, `exchangePlaidPublicToken`,
  `markPlaidItemUpdated`, `removePlaidItem`, `findOverlappingAccounts`);
  `apps/api/src/finance-plaid.ts` (the four handlers); `apps/api/src/finance.ts`
  (`financeConnect` refusal); `apps/api/src/finance-agent.ts` (instructions); `plaid-fake.ts`
  (`failNext`, update mode, `/item/remove` outcomes); `rpc.ts`, `router.ts`
  (`finance.plaidLinkToken`, `plaidExchange`, `plaidUpdated`, `plaidRemove`).
- **Behavior.** Design items 4 (server side), 6 (overlap), 8 and 9. Copy, all of it, as quoted
  in those items.
- **Acceptance (tests first).**
  - `plaid-link.test.ts` (fake fetch, Prisma stand-in): token request fields for new and
    update mode; exchange refused before any Plaid call when a selected account matches a
    stored Plaid, Mercury or statement account by mask and kind; distinct accounts at the same
    institution are allowed; Brex through Plaid refused while a Brex server exists; a DB failure
    after exchange calls `/item/remove`; a retry after a committed exchange is refused
    by the overlap check before any Plaid call; a retry after a rollback fails with the Plaid
    error; neither stores anything new.
  - `plaid-link.postgres.test.ts`: exchange stores Item, secret **and accounts** in one
    transaction and enqueues the job; two concurrent exchanges of overlapping account sets end
    with exactly one Item (the advisory lock); `ensureFinanceAgent` created the agent for a user
    with no other source; remove deletes item, secret and rows by cascade; a failed remove keeps
    the row and the secret; cross-user and cross-space update and remove fail without touching
    the other connection; a cancelled update leaves `needsReconnect`.
  - `finance-plaid.postgres.test.ts`: the handlers through `FinanceDeps`; `financeConnect`
    refuses Mercury while a Plaid Mercury Item exists and names the reason.
  - `router.test.ts`: the four procedures are authed.
- **Verify.** `pnpm vitest run packages/adapters/src/plaid-link.test.ts apps/api/src/router.test.ts`;
  `pnpm test:integration`.
- **Hand test.** Demo over real HTTP as the seeded founder (`/rpc/finance/plaidLinkToken`,
  `/rpc/finance/plaidExchange` with `publicToken: "public-fake-ally"`): the new Item appears in
  `finance/overview` with its accounts at once and `importing: true`, then with rows after the
  delayed runs; exchange the same account set again and get the overlap message; exchange
  `public-fake-brex` while Brex is connected and get the Brex message; disconnect Mercury,
  exchange `public-fake-mercury`, then `finance/connect` Mercury and get the other message;
  `plaidUpdated` after `resetLogin`; `plaidRemove` and see the rows gone. As a second,
  non-owner user in the demo space: `plaidExchange` works.
- **Stories.** None.
- **Mobile.** No change.

### PR D. Web connection experience

- **Scope.** The Link script, one bank entry on Integrations with inline institutions,
  `Other bank` in Add account, importing and error states, stories, a real-application e2e.
  (Simpler.)
- **Prerequisites.** PR C.
- **Files.** `apps/web/src/lib/plaid-link.ts` (+ test); `apps/web/src/lib/finance-connect.ts`
  (`connectPlaid({ itemId? })`: token → Link → exchange or updated; + test);
  `apps/web/src/components/integrations/FinanceSection.tsx` (the `Bank account` tile with
  institution lines; `connectedFinanceKeys`; + test, stories); `IntegrationsHome.tsx` (passes
  `plaidAvailable`); `apps/web/src/components/finance/AddAccountDialog.tsx` (+ test, stories);
  `apps/web/src/pages/Finance.tsx` (importing poll, banner opens Link, `Add account` link; +
  test, stories); `apps/web/e2e/plaid.spec.ts`; `apps/web/e2e/fixtures/plaid-link-stub.js`.
- **Behavior.** Design items 4 (client side), 7 (visible state) and 10. Copy, all of it: tile
  `Bank account` with line `Chase, Amex and other banks, through Plaid` (the tile must say which
  banks it reaches; "through Plaid" says whose page opens next); `Connect`, `Open Finance`,
  `Connect another bank`; per-institution `Reconnect` and `Disconnect`; owner-only `Set up` when
  unconfigured; option `Other bank` with line `Chase, Amex and more, through Plaid`; source
  line `<Bank> · importing…`; errors as returned by the API, and `Could not connect. Try
  again.` from `onExit` with an error.
- **Acceptance (tests first).**
  - `plaid-link.test.ts` (web): the script is injected once; `open` resolves with the
    `onSuccess` arguments; `onExit` with an error rejects, without one resolves `cancelled`.
  - `finance-connect.test.ts`: `connectPlaid` calls `plaidLinkToken`, then `plaidExchange`
    with the metadata, or `plaidUpdated` in update mode; a cancel calls neither.
  - `FinanceSection.test.tsx`: one tile whatever the number of Items, one line per
    institution with its own status; `Disconnect` calls `plaidRemove` and shows the error when
    it fails; `Reconnect` starts update mode; the tile is absent without `plaidAvailable` for a
    non-owner and shows `Set up` for an owner.
  - `AddAccountDialog.test.tsx`: `Other bank` only with `plaidAvailable`; it starts
    `connectPlaid`.
  - `Finance.test.tsx`: the overview is re-read while a source is importing and stops when it
    is not; the Plaid banner's button starts update mode.
  - `e2e/plaid.spec.ts` against the emulated stack, as a **non-owner** user with the CDN script
    stubbed: Integrations shows `Bank account`; Connect → the stub's `onSuccess` → the tile
    lists the fake institution as connected; Finance shows `importing…`, then the account in
    Cash after the delayed runs (screenshot `plaid-connected`); Add account shows `Other bank`;
    cancel in the stub leaves nothing connected; Disconnect removes the bank and its figures.
- **Verify.** `pnpm vitest run apps/web/src/lib/plaid-link.test.ts apps/web/src/lib/finance-connect.test.ts apps/web/src/components/integrations/FinanceSection.test.tsx apps/web/src/components/finance/AddAccountDialog.test.tsx apps/web/src/pages/Finance.test.tsx`;
  `pnpm test:e2e --spec=e2e/plaid.spec.ts`; `pnpm design-system`; `pnpm design-system:check`;
  in `apps/web`: `build-storybook`, then `node .storybook/smoke.mjs storybook-static integrations/FinanceSection`,
  `node .storybook/smoke.mjs storybook-static finance/AddAccountDialog` and
  `node .storybook/smoke.mjs storybook-static pages/Finance.stories` (the filter matches the
  import path, so a `Plaid` filter would match none of them).
- **Hand test.** Demo: the real Link script loads from the CDN and `onExit` is handled (Link
  cannot complete against the fake server; the e2e stub proves the rest); the seeded Chase shows
  as a line on the tile; Disconnect removes it and its figures; the owner path shows `Set up`
  after deleting the config row.
- **Stories.** `FinanceSection.stories.tsx` (no Item, one and two institutions, needs
  reconnect, importing, owner unconfigured), `AddAccountDialog.stories.tsx` (with `Other
  bank`), `Finance.stories.tsx` (importing line). Run `pnpm design-system`.
- **Mobile.** Not available; connecting happens on web or desktop (Out of scope). Mobile users
  see nothing new.

### Gate. Sandbox verification (release gate, not CI)

Kept as its own tracked step because it needs operator-supplied Plaid Sandbox keys that
implementers do not have, and because real Link, OAuth and Electron behavior cannot be proven
offline. **Owner:** whoever runs the gate (the maintainer). Each failing step gets a follow-up
issue and fix PR filed from the gate issue, naming the owning PR; nothing in PRs A to D waits
on the gate.

- **Needs.** Sandbox keys entered on `/integrations/setup` (environment `Sandbox`); a stack
  from the merged branch (`pnpm dev`, not the demo, which uses the fake); the desktop build
  pointed at it; a scratch script using `createSecretStore` and `secrets.load` to read one
  Item's access token for the `/sandbox/*` calls (never committed). No public URL is needed
  (no webhooks).
- **Prerequisites.** PRs A to D merged.
- **Checklist.**
  1. Web: Link with the sandbox test bank (`user_good` / `pass_good`): exchange, the
     institution on the tile with its accounts in Cash at once, transactions in Spend after the
     initial import; the source line goes from importing to synced without a reload, and
     `importStatus` reaches `complete` (not `stalled`).
  2. Web: the Platypus OAuth bank (`ins_127287`): the bank popup opens from Link and completes
     back into it.
  3. Desktop (Electron): steps 1 and 2 again. Record whether the OAuth popup stays in the app
     or goes to the system browser; if it goes out, file the pre-planned follow-up PR (Design
     item 4, Electron) and repeat.
  4. `POST /sandbox/item/reset_login`: the next Refresh sets needs-reconnect; the banner's
     `Reconnect` opens update mode; completing it recovers; closing Link instead leaves the
     banner.
  5. Link the same test bank again with the same accounts: refused before exchange, and the
     Plaid Dashboard shows no second Item. Link it with a different sandbox login
     (`user_custom` with other account masks): allowed.
  6. Confirm `DIRECT_FEED_INSTITUTIONS` with `/institutions/search` (A11); with Mercury
     connected directly, link Plaid's Brex while Brex is connected and see the refusal; connect
     Mercury directly while a Plaid Mercury Item exists and see the other refusal.
  7. `Disconnect`: `/item/remove` succeeds, the line and the figures are gone, the Dashboard
     shows the Item removed.
  8. Confirm the PFC version in use (A10) and that the fixtures' category names match.
- **Record.** Dates and outcomes under Review record; no test command.

## Out of scope and follow-ups

- **Webhooks** (`SYNC_UPDATES_AVAILABLE`, `ITEM_LOGIN_REQUIRED`, `PENDING_DISCONNECT`,
  `USER_PERMISSION_REVOKED`): a later PR adds the verified route (`Plaid-Verification` JWT,
  ES256 through `node:crypto` as `gmail-push.ts` does for RS256), a request flag the running
  sync honours (the pattern in `mail-sync-job.ts`), and a page refresh. Until then sync runs
  on open, on Refresh and during the bounded initial import.
- **Adding accounts to a connected Item** (update mode with `account_selection_enabled`).
  Until then: disconnect and reconnect the bank with the wanted accounts.
- **Own-account transfers without an account identifier in the description** (Design item 6).
- **Electron OAuth popup allowance** (Design item 4), only if the gate shows it is needed.
- **Mobile Plaid Link.** Needs an Expo dev build with `react-native-plaid-link-sdk` and
  universal links for OAuth. Mobile has no Finance screen and nothing to connect from; the
  Finance agent already answers there with the synced data.
- **Hosted multi-tenant service on one Plaid key**: commercial arrangement TBD (A5).
- **Liabilities, Investments, Statements products and real-time `/accounts/balance/get`.**
- **Currency conversion.** Non-USD accounts and transactions are stored and shown, never
  summed.
- **Receipts and categories for Plaid rows.** Plaid has no receipts; categories are Plaid's.
- **Per-institution filter on Spend and Accounts.**

## Open questions

Nothing below could be verified from the code or the research notes; none blocks PRs A to D.

1. Link in Electron: whether the OAuth bank popup opened by Link's iframe stays inside the app
   window. Gate step 3; the fix is a pre-planned follow-up PR.
2. Whether a request option selects the PFC version, and which version the operator's account
   returns (A10). PR B checks the API reference; gate step 8 confirms.
3. Which Plaid error codes beyond `ITEM_LOGIN_REQUIRED` mean "reconnect" in practice (one
   function, `plaidFailureReason`, to adjust).
4. How often `/accounts/get`'s cached balances refresh without webhooks; if too rarely, a
   periodic real-time balance read is a paid follow-up.
5. How reliably transfer descriptions carry the destination's last four across institutions;
   this bounds the own-account transfer rule and decides whether the follow-up is needed soon.

## Review record

- 2026-10-21: plan written against base `5fa362841`.
- 2026-10-21: first Astra review (Codex). Changes taken: standard web Link script instead of
  Hosted Link (and the done page, session table and popup/BroadcastChannel flow); the "no
  desktop change" claim corrected; webhooks cut, bounded delayed `financeSyncJob` runs for the
  initial import; `/accounts/get` for inventory and balances; USD-only cash; refund, loan and
  card-payment rules corrected; duplicate Items detected from Link metadata before exchange;
  availability boolean on the overview for non-owners; `hasFinanceSource` and
  `ensureFinanceAgent` for Plaid-only users; recovery and the environment/client-id guard;
  mobile setup screen and hosted arrangement corrected; logo, abstraction note, unverified
  figures and estimates removed; three implementation PRs with outcome-based acceptance.
  Rejected: folding the Sandbox verification into the implementing PRs (it needs
  operator-supplied keys that implementers do not have, and the owner asked for it to be
  tracked on its own).
- 2026-10-21: second Astra review (Codex), of the epic decomposition. Changes taken:
  - PR 1 split into PR A (keys, schema, client, fake, settings, setup page, seam) and PR B
    (ingestion and accounting, including the initial-import re-enqueue moved here from the
    lifecycle PR); four implementation PRs plus the gate.
  - `pairInternalTransfers` cut; own-account transfers are internal only when the counterparty
    identifies one of the user's accounts (last four or Mercury name); the remaining gap is a
    named limitation and follow-up.
  - The 10-minute duplicate-exchange window cut; a retried exchange fails at Plaid (single-use
    token) and the client re-reads the overview; `/item/remove` after a DB failure kept.
  - Institution-wide `DIRECT_FEED_INSTITUTIONS` refusal replaced by an account-level overlap
    check (mask + kind against stored accounts of any source) inside a per-user advisory lock,
    with the Item's accounts inserted during exchange so concurrent or quick second exchanges
    cannot both pass. Institution ids are used only where no account can be compared: Brex
    through Plaid (Brex exposes no masks) and direct OAuth connects after a Plaid Item, with
    the reason stated. Ids taken from Plaid's coverage CSV (A11).
  - `PlaidBanksDialog` and the Add-accounts mode cut; institutions are listed inline on the
    `Bank account` tile with Reconnect and Disconnect; the Finance banner reopens update mode.
  - Mercury repayments to a Plaid-connected card are `card_payment` through one card-source
    rule shared with Brex, with a cross-provider regression test.
  - USD-only applied to `cashSummary`, `cashHistory`, `cashAtDays` and `hasCashAccounts` through
    one predicate; transaction currency in the mapping.
  - Initial import completes only on `transactions_update_status = HISTORICAL_UPDATE_COMPLETE`;
    retry exhaustion is `stalled`, distinct from complete, and delayed history is tested.
  - Balance contract: every discovered account of a supported type is stored; unknown
    (`balanceKnownAt` null) balances are excluded from cash sums and shown as unavailable; stale
    balances stay in the sums and show their date.
  - Hand tests look for the card payment on the account page with the real label
    `Card payment · not spend` (Spend excludes it); Storybook smoke filters match import paths.
  - Gate failures have an owner and a follow-up PR; the Electron change is pre-planned
    conditional work, not a backward dependency.
