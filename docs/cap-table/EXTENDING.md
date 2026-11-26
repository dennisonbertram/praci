# Extending the cap table

One area adds a feature by adding files in its own folders and one line in each marked place of
the shared files below. Do not move or reorder other areas' lines; append inside your own marker.

| What | Where | Marked place in a shared file |
| --- | --- | --- |
| Model or field | `packages/db/prisma/schema.prisma` | append under `// ---- cap table: <area> area ----` (after `// ==== End cap table foundation section`). New fields on a foundation model: add them in your block as a new related model, or edit the foundation model and note it in your report. |
| Migration | `packages/db/prisma/migrations/<timestamp>_equity_<area>_<what>/migration.sql` | none. Every new table carries `spaceId` and `userId`, the composite relation to `equity_ledgers`, and the `_tenant` / `_system` row-level security policies copied from `20261231000075_equity_ledger`. |
| Contract | `packages/contracts/src/equity/<area>-<what>.ts` | one `export * from "./<file>.js";` line in `packages/contracts/src/equity/index.ts`; procedures under `// ---- <area> area ----` in `packages/contracts/src/equity/rpc.ts`. Enumerations come verbatim from the Carta reference. |
| Domain math | `packages/core/src/equity/<what>.ts` plus `<what>.test.ts` | one export line in `packages/core/src/equity/index.ts`. Pure functions, BigInt and fixed-point (`fixed.ts`), never floats. |
| Store | `packages/db/src/equity/<area>-<what>.ts` plus `.postgres.test.ts` | one export line in `packages/db/src/equity/index.ts`. Copy `stakeholders.ts`: `(prisma, actor, input)`, parse with the contract, filter by `scopeOf(actor)`, `assertInLedger` every referenced id, `ensureLedger` + `inTransaction` on create, `recordTransaction` for every change to an issued security. Tests use `equityFixture` / `describeEquityPostgres` and must prove another user and another space cannot read, write or reference your rows. |
| Procedure | `apps/api/src/equity/<area>-<what>.ts` (handlers wrapped in `equityCall`) | spread your routes under `// ---- <area> area ----` in `apps/api/src/equity/index.ts`. |
| Tab content | `apps/web/src/components/cap-table/<area>/**` and `apps/web/src/pages/cap-table/**` tests | replace your tab's `element` under `// ---- <area> area: replace this tab's element ----` in `apps/web/src/pages/cap-table/tabs.tsx`. The shell, routes and sidebar need no change. |
| Story | sibling `<Component>.stories.tsx` with real states, `mockRpc` for calls, invented data from `demoLedger()` | regenerate `docs/design-system/components.md` with `pnpm design-system`. |
| Seed row | `packages/core/src/equity/demo-ledger.ts` (invented data only) | add rows in the matching array; the demo seed loads them through the stores. |
| Translation | wrap copy in Lingui `t`/`<Trans>` | run `pnpm --filter @rakazo/web intl:extract` and commit the catalogs. |

Tab owners: stakeholders → stakeholders; securities → securities, rounds; options → plans;
views → overview extras, share-classes, reports; access → access, activity.

Data backfills (migration `20261231000156`) are plain SQL that Prisma cannot express; they must be
idempotent and, for parent-to-child chains, repeat until a pass changes nothing.

## Commands

```sh
pnpm install --frozen-lockfile && pnpm --filter @rakazo/db generate
pnpm db:migrate                           # after writing your migration SQL by hand
pnpm check                                # mobile's expo version check fails on its own; see reports
pnpm design-system && pnpm design-system:check
npx biome check --write <your files>
pnpm vitest run packages/core/src/equity packages/contracts/src/equity apps/web/src/pages/cap-table apps/web/src/components/cap-table
# Postgres: the runtime login, so row-level security applies (recipe in briefs/foundation-workers/store-common.md)
VERIFY_DATABASE=1 DATABASE_MIGRATION_URL=<owner url> DATABASE_URL=<runtime url> \
  pnpm vitest run packages/db/src/equity apps/api/src/equity
DEMO_SLOT=0 pnpm demo:up                  # seeded ledger; open /app/cap-table/<tab>
```

## Migration forms Prisma cannot express

The repo has no schema drift check, so these live only in migration SQL and `schema.prisma`
does not show them. A later `prisma migrate diff` or `migrate dev` will try to undo them; do not
apply its output blindly.

- Partial unique indexes: `equity_document_links_{stakeholder,certificate,round}_key` and
  `equity_stakeholder_changes_portal_pending_key`
  (migration `20261231000136_equity_link_integrity`).
- `ON DELETE SET NULL ("contactId")` on `equity_stakeholders_contactId_spaceId_userId_fkey`. The
  column-list form needs PostgreSQL 15+ (compose and CI run 16). Prisma would emit a plain
  `SET NULL`, which also tries to null the NOT NULL `spaceId` and `userId`.
- The append-only trigger `equity_audit_events_append_only` on `equity_audit_events` (migration
  `20261231000161_equity_audit_events`). It blocks UPDATE and DELETE for every role, except a
  DELETE whose ledger row is already gone (the foreign key cascade when a whole ledger is
  deleted). `equity_transactions` has no such trigger yet: the demo seed backdates its `createdAt`
  with an UPDATE (`spreadDemoEquityActivity`), so it needs a change first.

Audit rows: a change to access levels, a contact or document link, the estimated value settings
or a stakeholder calls `recordEquityAudit` (`packages/db/src/equity/audit.ts`) in the same
transaction. Securities changes keep using `recordTransaction`. A write that leaves a level or the
estimated value as it was records nothing. Because these rows cannot be erased per person, a
stakeholder edit stores values only for an allowlist of non-personal fields (`AUDITED_VALUES` in
`stakeholders.ts`); every other changed field, such as date of birth, emails, addresses and tax,
employee and payroll ids, is stored as `"[changed]"`. A dated property edit is stored by kind
(`propertyKinds`), not by value.

Rules that do not change: every query is scoped to the caller's space and user; issued securities
are never deleted, changes go through transactions; wire share counts and cents are integer
strings, prices decimal strings, dates YYYY-MM-DD.

## Lock order

Every write that locks rows takes the ledger row first (`lockEquityLedger`), then other rows in
sorted id order (`lockEquityRows` helpers). `assertInLedger` on a stakeholder takes the ledger lock
itself before its `FOR SHARE` on the holder, so any path that checks a holder is safe. A path that
locks a holder, certificate or grant before the ledger can deadlock with a merge.

## Retry-safe creates

The create paths for certificates, option grants, convertible terms and convertibles, warrants,
stakeholders and share transfers take an optional `requestKey` (a client-generated UUID), as
option exercises do. The row stores the key and a hash of the request (`requestKey`,
`requestHash`, migration 146); a retry with the same key and the same request returns the first
result, and the same key with different terms is a conflict. The check runs after the ledger
lock, and a unique index on space, user and key backs it. A transfer stores the key on its
`equity_transactions` row. Data room delivery (`investors.share`) keeps its keys in
`investor_share_requests` (migration 147); a replay sends nothing and returns no links, because
only link hashes are stored. Web dialogs make one key per dialog open.

`prisma migrate diff` is accurate for these two migrations. The only part Prisma cannot express is
the row-level security policies on `investor_share_requests`, which follow the other tables; the
repo has no drift-check script to keep green.

## Things Prisma cannot express

- `equity_stakeholders_contactId_spaceId_userId_fkey` uses `ON DELETE SET NULL ("contactId")`,
  which needs PostgreSQL 15 or later. Migration 20261231000107 checks the server version first and
  stops with a clear message. `schema.prisma` shows `NoAction`; do not regenerate the constraint
  from the schema.
- The `<table>_<column>_values` CHECK constraints (migration 20261231000141) are copies of the
  contract lists. `value-checks.postgres.test.ts` compares each constraint to its contract list, so
  adding a value to a contract list fails that test until a new migration widens the constraint.

## Deleting a shared space

Deleting a space erases the deleter's own ledger in it. It is refused (`SpaceHasCapTableError`,
"This space contains a cap table and cannot be deleted") while another member still has a ledger
there, because row-level security hides that ledger from the deleter. Deleting an account removes
the account's own ledgers through the cascade.
