# Composio Instant plan

## Goal

Let agents use paid tools (Exa and Parallel search, Apollo and People Data Labs
enrichment, ZeroBounce, Higgsfield video, scraping, transcription) without anyone
opening an account with each vendor, by turning on
[Composio Instant](https://composio.dev/blog/composio-instant) in Rakazo's
existing Composio integration. Instant (launched 2026-10-08) charges each call to
the Composio organization's wallet: $2 of starting credit, $29 a month on Pro,
failed calls free, and no charge when the user has connected their own account for
that tool.

Web and desktop ship first. Approval cards already render on mobile, so mobile
needs no new UI unless the spend view (decision 5) is added there later.

## Who pays

Rakazo holds **one Composio key per deployment** (`COMPOSIO_API_KEY`, or the key
the deployment owner saves in integration setup). Every Instant charge from any
user in any space is billed to that one wallet. For a self-hosted install the
owner is paying for their own use. On a shared deployment, one user's agent spends
the operator's money. Every decision below follows from that.

## Decisions

1. **Off by default; only the deployment owner turns it on.** Integration setup
   (`integrationSetup.save`, already limited to `isDeploymentOwner`) gains an
   Instant switch and the list of Instant toolkits to offer. Nothing changes for a
   deployment that never turns it on.
2. **Instant toolkits connect like no-auth toolkits.** Rakazo already stores
   no-auth Composio apps as a `Connection` row whose `providerRef` is the toolkit
   slug (`composio-connector.ts`, `sessionForExecute`). An Instant toolkit does the
   same, so per-agent access (`BotConnectionAccess`) and the catalog keep working.
   The catalog tile says the call is paid, with the price when Composio returns
   one.
3. **One SDK upgrade, and every session states its Instant policy.**
   `@composio/core` 0.18.1 → 0.24.0 (the Instant contract landed in 0.22.0, and
   prices in search in 0.24.0). Composio's docs say that leaving out `instant`
   **permits** Instant once the project allows it, including in existing
   sessions, and that allowing one toolkit does not exclude the others. So:
   - When Instant is off for the deployment, every catalog and execute session
     passes `instant: false`. This is needed even before Rakazo uses Instant,
     in case someone turns it on in the Composio dashboard.
   - When it is on, execute sessions allow only the toolkits the owner enabled
     **and** the user connected through Instant, excluding everything else (the
     exact allow-only shape is confirmed in the spike), with
     `returnInstantCharge: true`. A toolkit the user connected with their own
     account is never charged.
   - The policy is part of the execute-session cache key
     (`executeSessionKey` in `composio-connector.ts`), so changing it never
     reuses an old session.
4. **Every paid call needs approval, every time.** Instant tools are often named
   `search` or `find`, which `action-approval.ts` treats as read-only and runs
   without asking. A paid Instant call goes through the mandatory approval path
   (`toolRequiresExplicitApproval`), which ignores saved rules and Auto Review.
   The approval card shows the tool, its arguments, the reserved amount and
   "Paid with Composio credit". **Paid tools are refused inside
   `COMPOSIO_MULTI_EXECUTE_TOOL`** in v1, because the approval gate sees only the
   outer tool name; the agent calls them one at a time.
5. **Spending is reserved before the call and reconciled after.** Composio has no
   spending cap, and `instantCharge` arrives only after execution. Its docs
   prescribe an application-side budget, which Rakazo implements in Postgres:
   - An `InstantCharge` row is **reserved** before the call with a trusted upper
     bound on its cost, in the same transaction that checks the user's remaining
     monthly budget, so concurrent workers cannot spend the same balance. A call
     whose cost cannot be bounded is refused while a cap is set.
   - The row is keyed by the approval effect's idempotency key, so a retry after a
     crash finds the earlier reservation instead of paying twice.
   - After the call, the row is settled to the actual `instantCharge`. A timeout or
     missing charge leaves it reserved until it is reconciled against Composio's
     execution log.
   - The cap is **per user across the whole deployment**, because every space
     shares one wallet. The deployment owner sets it; rows also carry spaceId and
     botId for the spend view. Amounts are exact decimals, never floats.
   - The Integrations page shows the user's spend this month.
6. **Tests stay offline.** The Composio emulator (`composio-emulator.ts`) learns
   the `instant` option and returns a fixed `instantCharge`, so execute, approval,
   charge recording and the cap are tested without the network.

## Treg and Instant

They overlap: both sell pay-per-call tools. Treg bills **the user's own Treg
balance** and covers more providers (about 111); Instant bills **the deployment
owner's Composio wallet** and covers about 100 toolkits inside the Composio setup
Rakazo already has. Keep both. Instant suits a self-hosted owner who already pays
for Composio; Treg suits users who should pay for themselves. Neither is required
to run Rakazo.

## Not in v1

- Billing users for what they spend (Rakazo only records and caps).
- Instant on mobile beyond the existing approval card.
- Long-running Instant jobs (browser tasks, phone calls), which Composio has not
  shipped.

## PR breakdown

1. Spike: upgrade the SDK on a branch, enable one toolkit (Exa) against a real
   Composio project with the $2 credit, and record here: how Instant toolkits
   appear in the directory, what `instantCharge` looks like, whether prices come
   back from search, and how Instant behaves in a session that also passes
   `connectedAccounts`. Run the existing Composio tests after the upgrade.
2. `instant: false` on every catalog and execute session, in the cache key. Ships
   first and on its own, because it closes a gap that exists today: a project
   where someone turns on Instant in the Composio dashboard would otherwise spend
   without Rakazo knowing.
3. The safeguards, with nothing able to turn Instant on yet: mandatory approval
   for paid calls, the batch-execution refusal, the `InstantCharge` reservation,
   the per-user cap, emulator support and tests.
4. Only now the owner's setup switch and toolkit list, Instant tiles in the
   catalog, and the no-auth-style connect. No release can offer paid tools
   before the approval and the cap exist.
5. Spend line on Integrations; CI screenshot.

## Open risks

- **The SDK jump is six minor versions.** 0.18 → 0.24 may change session or
  connection behavior Rakazo relies on (multi-account selection,
  `connectedAccounts`). The spike runs the full Composio test set first.
- **Price before the call is not guaranteed.** Search prices are an experimental
  option, and Composio says not to treat the published price as a quote. If the
  spike finds no reliable upper bound for a toolkit, that toolkit stays off.
- **Shared wallet abuse.** Until the cap ships, an enabled deployment depends on
  the per-call approval alone.
- **Unknowns.** Which Instant toolkits exist today, and whether the deployment's
  Composio plan allows adding funds (Pro only). Both are TBD until the spike.
