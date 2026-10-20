# Hosted paid Praci: private beta plan

Status: plan, not implemented. Base: `main` at `a6f34f3ee`. Fork: `dennisonbertram/rakazo`
(`app.praci.ai` and its CI deploy belong to upstream and are out of scope). Line numbers below are
at that commit and drift; `~` marks a number confirmed only approximately on later `main`.

The private beta ships exactly the blockers that stop the operator from charging for a shared
deployment today: server-side subscription enforcement (runs and computer wake), a hard monthly AI
allowance, hosted bootstrap, a complete authorization sweep, and a deploy runbook. Everything is off
unless the operator sets the corresponding environment values, so self-hosters see no change
(VISION.md: "A managed Praci service ... does not become a hidden dependency of the self-hosted
core").

Prices are TBD throughout: per-seat price and allowance amount are operator settings, not code.

## How each slice traces to the framing

| Framing outcome | Slice |
| --- | --- |
| "A lapsed subscription stops consistently on every surface, not only on web" | 1, 2 |
| "A customer who hits the allowance sees a clear stop and how to continue"; BYOK runs do not count | 4, 5 |
| Operator: "uncapped AI or sandbox spend" | 2, 5, 7 (sandbox caps are configuration, see Decisions) |
| "Nobody can claim the deployment by signing up first. Host-only features are off." | 6 |
| Operator: "one customer reading another's data" | 3 |
| Operator need: know when the service breaks | 7 (Axiom monitor; Sentry is a later phase) |
| "Sign in on web, desktop or mobile ... without running servers" (operator runs one VM) | 7 |

## Decisions

### No "hosted mode" flag

Hosted is already expressed by existing configuration, and nothing in this plan needs a
behaviour that those values cannot select:

- Billing on: all three `STRIPE_*` values (`stripeBillingConfigFromEnv`,
  `packages/adapters/src/stripe-billing.ts:354`; all-or-nothing, partial config stops startup).
- Invite-only signup with mailbox proof: `SIGNUP_ALLOWLIST` non-empty plus `SMTP_URL`/`EMAIL_FROM`.
  With both set, `packages/auth/src/index.ts:438-446` sets `requireEmailVerification = true` and
  `index.ts:503-511` refuses a session to an unverified user. No code change.
- Host-only features off: `MCP_ALLOW_PRIVATE_ENDPOINT` unset (`packages/adapters/src/private-endpoint.ts:14`
  then grants private endpoints to the deployment owner only); `SANDBOX_PROVIDER=e2b` (then
  `deployment.update` rejects `computerHost: "this-mac"`, `apps/api/src/router.ts:1468-1473`);
  `RAKAZO_LOCAL_MODELS`, `CLOUD_AGENT_PROVIDER` and the `updater` Compose profile unset;
  `MESSAGING_OPEN_SIGNUP=false` (auto-provisioned chat accounts would bill the platform key,
  `.env.example:182-184`).
- The one genuinely new behaviour, "the operator is not whoever signs up first", needs a value
  (which account is the operator), so it gets one env value in slice 6. That is a setting, not a
  mode.

### Allowance: pooled per organization, seats x one optional env value, calendar month, hard stop

- `BillingAccount` is keyed by `organizationId` (`packages/db/prisma/schema.prisma`, model
  `BillingAccount`), and seats are already the organization member count
  (`organizationSeatCount`, `packages/db/src/billing.ts:72-78`). Pooling per organization needs no
  new table: allowance = `(account.seats ?? organizationSeatCount) x BILLING_AI_ALLOWANCE_USD`.
- One env value, `BILLING_AI_ALLOWANCE_USD` (US dollars per seat per calendar month, UTC). It is
  optional: unset means no cap. It is not part of the Stripe all-or-nothing check, because that
  would stop existing Stripe self-hosters from starting. A malformed value (not a non-negative
  finite number) stops startup. A value of `0` blocks the first platform-key call (kept as a test
  case).
- Period = calendar month in UTC. `BillingAccount` stores `currentPeriodEndsAt` but not the period
  start, and calendar months are deterministic in tests. Mismatch with the Stripe invoice period is
  accepted for the beta (open question 1).
- Trialing organizations get the same allowance as paying ones; `hasBillingAccess` already treats
  `trialing`, `active`, `past_due` alike (`packages/db/src/billing.ts:6-10`).
- BYOK runs do not count: only usage rows made without a user credential are summed (slice 4 tags
  them). The cap is checked once per model resolution, not per token, so one run can overshoot by
  its own spend. Accepted; a per-call check would need the Pi runtime to consult the database
  mid-stream.
- Hard stop only. No usage meter in the UI for the beta; the stop message says how to continue.

### Sandbox cost: existing caps plus a billing check on every wake path, no minutes ledger

E2B bills per running second and the adapter already pauses idle sandboxes: `e2bCreateOptions`
sets `timeoutMs: sandboxIdleMs()` and `lifecycle: { onTimeout: "pause" }`
(`packages/adapters/src/e2b-sandbox.ts:37-43`). A computer does not only wake for a run. These
router procedures all reach `box()` (`packages/adapters/src/e2b-sandbox.ts` ~109), whose E2B
`connect` resumes a paused sandbox, and they push the idle timer: `computer/screenUrl` (~3577),
`computer/terminalUrl` (~3522), `computer/files` (~3400), `computer/readFile` (~3422),
`computer/downloadFile` (~3448), `computer/uploadFile` (~3486), `computer/heartbeat` (~3624) and
`computer/boot` (router.ts ~2946; the fix site is ~2309). Slice 2 closes them with one billing check. With slices 1, 2 and 5 stopping
runs and wakes for lapsed or exhausted organizations, the existing knobs bound spend:

- `SANDBOX_IDLE_MS` (default 600000) pauses an idle E2B sandbox.
- `SANDBOX_MAX_COMPUTERS_PER_USER` caps `Computer` rows per user in `packages/db/src/computers.ts`
  (`assertComputerQuotaForRestore`, `restoreBotUnderComputerQuota`; `ComputerLimitError` becomes
  `BAD_REQUEST` at `apps/api/src/router.ts:933`). It is provider-neutral, unlike
  `SANDBOX_MAX_COMPUTERS_PER_SPACE`, which only the Docker supervisor reads
  (`infra/sandboxes/supervisor/src/computer-spec.ts:28`). It is enforced only on restore
  (`router.ts` ~2311, `packages/db/src/computers.ts` ~102,128); the first computer per bot is not
  limited. Accepted for an invite-only beta; the runbook states it.
- `SANDBOX_COMMAND_TIMEOUT_MS` and `MAX_TOOL_CALLS_PER_TURN` bound a single turn.

A minutes ledger would need start/stop history that the `Computer` table does not keep and a
second enforcement path; nothing in the framing requires per-minute accounting for the beta. The
runbook (slice 7) sets these values.

### Error reporting: Axiom monitor now, Sentry later

`createRootLogger` (`packages/logging/src/axiom.ts:74`) already ships `level: "error"` events to
Axiom when `AXIOM_*` is set, from both the API and the worker. The beta uses that: the runbook has
the operator create one Axiom monitor on `level=error`. No code slice.

Sentry is moved to Later phases. Reason: it would add a second sink (or a new `@sentry/node`
dependency) for an outcome Axiom already delivers, and `@sentry/node` is not installed anywhere in
the workspace. Revisit if breadcrumbs, release tracking or symbolication are wanted.

### Blocked runs: fail the run with one sentence, no new UI

The executor already has the pattern for a run that cannot start: `failRunBeforeModel`
(`packages/adapters/src/executor.ts:3960-4003`) finalizes the run as `failed` with a message,
emits `run.failed` with `payload.error` (`packages/db/src/events.ts:1427-1433`), returns a status
message to a delegating bot, and sends one failure notification. The web thread already renders
`run.error` for failed runs (`apps/api/src/thread-target.ts:593-596`), which is how
`MISSING_MODEL_MESSAGE` ("Connect a model in Settings before running bots.",
`executor.ts:2749`) reaches users today. Mobile and messaging surfaces see the same run state.

Decision: when the error is a `BillingBlockedError`, `failRunBeforeModel` skips the push
notification, so a lapsed organization with hourly routines is not pushed on every wake. The failed
Run rows remain, so the stop is still visible in the thread.

New user-facing copy (two strings, both run errors; the first is also the `FORBIDDEN` message on
computer procedures in slice 2):

- `Subscription required` — identical to the paywall title in `apps/web/src/pages/Paywall.tsx:48`,
  so web users who somehow reach a thread see the same words the paywall shows.
- `Monthly AI allowance used. Connect a model in Settings to continue.` — the stop and the way to
  continue in one sentence, parallel to the existing missing-model message. Nothing else is added:
  no banner, no meter, no settings copy. Web keeps the existing `SubscriptionGate` paywall; mobile
  has no paywall screen and relies on the server (a mobile paywall is a public-launch item).

## The choke points (verified)

Runs. Every run path ends in a `run.continue` job: 34 `runContinueJob(...)` enqueue sites across
`apps/api/src/{router,thread-target,messaging-inbound,webhook-inbound,taught-skills,legal}.ts` and
`packages/adapters/src/{executor,job-reconciler,cloud-agent-poll}.ts`; the single handler is
`"run.continue"` in `packages/adapters/src/background-job-handlers.ts:97-98`, which calls
`executor.continueRun` (`packages/adapters/src/executor.ts:3395`). Inside `continueRun`, the model
key for the run is resolved by `resolveModelKey` (`executor.ts:4019`), whose last branch returns
the deployment key when the user has no credential (`executor.ts:9999-10001`).

Deployment key. `deploymentKeyFor` (`executor.ts:9819`) is the only function that hands out the
operator's key, and it is called at two return sites (`:9875` and `:10002`). Slice 4 (tag) and
slice 5 (allowance) both go inside or around `deploymentKeyFor` (made async if needed), so there is
one place and both branches are covered. `platformKey` means "no user credential was used". That
includes host-credential and Bedrock paths where the key is `undefined`
(`packages/adapters/src/deployment-model.ts` ~44-50), so it is not `Boolean(apiKey)`.

Non-run model calls all reach the same function except one:

| Call site | Resolver | Covered by a check in `resolveModelKey`? |
| --- | --- | --- |
| Inbox triage, `packages/adapters/src/inbox-triage.ts:79` | `deps.resolveModel` = `executor.resolveModel` -> `resolveRunModel` -> `resolveModelKey` (`executor.ts:3117`, `3215-3216`) | Yes; a throw is caught at `:80` and reported as `no_model`, so triage skips |
| Data room jobs, `packages/adapters/src/data-room-models.ts:42` | same, via `resolveDataRoomAi` | Yes; caught at `:43` |
| Statement parsing, `apps/api/src/app.ts:604` | `triageStatus(..., executor.resolveModel)` | Yes |
| History compaction, `packages/adapters/src/history-compaction.ts:329` | `deps.resolveModel` when provided; the worker always provides `executor.resolveModel` (`background-job-handlers.ts:250`) | Yes |
| Mid-run judge key, `executor.ts:5159` | `resolveModelKey` directly | Yes |
| Team-chat engagement judge, `apps/api/src/team-chat-judge.ts:198-234` | its own resolver; uses `deps.deploymentModelKey` directly at `:231` | No. Slice 1 adds the subscription check to that branch |
| Cloud agents (`cloud-agent-poll.ts`) | provider API key from env, no `UsageRecord` | Not metered; hosted leaves `CLOUD_AGENT_PROVIDER` unset (open question 3) |

So one check in `resolveModelKey` plus one in the team-chat judge covers every model call. The
check lives there rather than in the `authed` RPC middleware (`apps/api/src/router.ts:1185`) because
messaging and webhook inbound, routines, and worker jobs never pass through that middleware, and
because the paywall itself needs `me` and `billing.status` to keep working.

Computer wake without a run. Eight router procedures (listed under Sandbox cost) resume a sandbox
from the API process. Slice 2 adds `assertComputerBillable(deps, actor)` at each. It cannot live in
`authed` for the same reason as above.

## Slices

Each slice is one PR of at most a day, mergeable on `main` plus its listed prerequisites. Tests are
written first and must fail before the behaviour change. Postgres-backed suites run only with
`VERIFY_DATABASE=1` and `DATABASE_URL` set; `pnpm test:integration` provisions a container and runs
every `*.postgres.test.ts` plus the listed testkit suites (`packages/testkit/src/cli/harness.ts:93-131`).

File ownership. Where two slices touch one file, the later one rebases over the earlier if it lands
first; hard prerequisites are only 2 on 1, 5 on 1 and 4, and 7 on 1-6 (docs).
Suggested waves: 1) slices 1, 3, 4, 6; 2) slices 2, 5; 3) slice 7. Shared files: `executor.ts` and `team-chat-judge.ts` (1, then 4, then 5);
`packages/db/src/billing.ts`, `billing-enforcement.postgres.test.ts`, `apps/worker/src/index.ts`
and `apps/api/src/app.ts` (1, then 5, then 6 for `app.ts`/`env.ts`). `apps/api/src/router.ts` is
owned by slice 2 alone.

### Slice 1: subscription enforcement at model resolution

Prerequisites: none.

Owned files:
- `packages/db/src/billing.ts`: add `billingBlockReason(prisma, { spaceId, userId, isDeploymentOwner }, config)`
  returning `null | "subscription"` (slice 5 adds `"allowance"`). It is built from the existing
  `organizationForMember` and `hasBillingAccess` and takes `isDeploymentOwner` (helper at
  `packages/db/src/scope.ts:42`) rather than re-reading `deploymentSettings`, mirroring
  `apps/api/src/billing.ts:82-96`. The deployment owner is never blocked; otherwise apply
  `hasBillingAccess(account?.status ?? null)`; no `BillingAccount` means blocked (same as the web
  paywall). If the executor has no actor, it resolves owner status from the run's `userId` through the same helper. Export a `BillingBlockedError` with the
  copy above as `message`.
- `packages/db/src/billing.postgres.test.ts`: cases for owner exemption, no account, each status.
- `packages/adapters/src/executor.ts`: `ExecutorDeps` gains `billing?: { allowanceUsdPerSeat?: number }`.
  Presence of `deps.billing` is the flag; there is no `enabled` field (the allowance field arrives
  in slice 5). `resolveModelKey` (`:9831`) calls `billingBlockReason` first when `deps.billing` is
  set and throws `BillingBlockedError`. `isTerminalModelSetupError` (`:3068`) accepts
  `BillingBlockedError`, so `continueRun`'s existing catch (`:4029-4035`) routes it to
  `failRunBeforeModel(error.message)`. `failRunBeforeModel` skips the failure push notification
  when the error is a `BillingBlockedError` (decision above).
- `apps/api/src/team-chat-judge.ts:231`: same subscription check before using
  `deploymentModelKey`; return `null` (no engagement) when blocked.
- `apps/worker/src/index.ts` and `apps/api/src/app.ts`: the API passes `billing: {}` into the
  executor when `billingProvider` (the `billingOverride` or Stripe provider, `app.ts` ~375-379) is
  set, not keyed on `stripeBillingConfigFromEnv`, so the testkit test with `BillingEmulator`
  actually blocks. The worker calls `stripeBillingConfigFromEnv(process.env)` (it does not read
  `STRIPE_*` today; the production Compose file already passes the shared `.env` to both services)
  and passes `billing: {}` when it returns a config.
- `packages/testkit/src/billing-enforcement.postgres.test.ts` (new; nearest example is
  `packages/testkit/src/authorization.test.ts`, which builds a real app on an isolated database):
  `createApp({ ..., billing: new BillingEmulator() })`, sign up user A, `threads/send`, assert the
  run ends `failed` with error `Subscription required` and no failure notification was sent;
  `billing/checkout` then `emulator.completeCheckout(customerId, "trialing")` and the webhook or
  `BILLING_RETURN_PATH`; send again, assert `completed` (scripted runtime);
  `emulator.setStatus(customerId, "canceled")` and webhook; assert blocked again. One routine wake
  for the blocked organization also produces a failed run with the same message. Organization B is
  unaffected throughout.

Checkable behaviour: with billing on, no run and no triage starts for an organization without
`trialing|active|past_due`; the run shows `Subscription required`; with billing off nothing changes.

Verification: `VERIFY_DATABASE=1 DATABASE_URL=... pnpm vitest run packages/db/src/billing.postgres.test.ts packages/testkit/src/billing-enforcement.postgres.test.ts`, then `pnpm vitest run packages/adapters/src/executor.test.ts apps/api/src/team-chat-judge.test.ts`. Manual: sign up on the local stack with Stripe test keys, send a message before checkout, see the failed run and the paywall; complete test checkout, send again.

### Slice 2: block computer wake without a subscription

Prerequisites: slice 1 (uses `billingBlockReason`). Sole owner of `apps/api/src/router.ts` in this epic.

Owned files:
- `apps/api/src/router.ts`: one helper `assertComputerBillable(deps, actor)` that, when `deps.billing`
  is set, calls `billingBlockReason` and throws `ORPCError("FORBIDDEN", { message: "Subscription required" })`
  when it returns a reason. Called at the start of `computer/screenUrl` (~3577), `computer/terminalUrl`
  (~3522), `computer/files` (~3400), `computer/readFile` (~3422), `computer/downloadFile` (~3448),
  `computer/uploadFile` (~3486), `computer/heartbeat` (~3624) and `computer/boot` (~2946; fix ~2309), before
  any call that reaches `box()`.
- `apps/api/src/router.test.ts`: the nearest existing computer coverage is the `computer screen url`
  describe block (~1395). Add a table-driven case there that calls each of the eight procedures
  with billing configured and an organization without an active subscription, asserting `FORBIDDEN`
  "Subscription required" and that the sandbox adapter was never called; plus one case that an
  active organization still succeeds and that the deployment owner is never blocked.

Checkable behaviour: a lapsed organization cannot resume or keep a paused sandbox alive by viewing,
uploading, downloading or heartbeating; with billing off nothing changes.

Verification: `pnpm vitest run apps/api/src/router.test.ts`.

### Slice 3: complete the authorization sweep

Prerequisites: none. Owns `packages/testkit/src/authorization.test.ts` only.

Background: test files are excluded from `tsc` (`packages/testkit/tsconfig.json` excludes
`src/**/*.test.ts`) and vitest does not typecheck, so the `exhaustiveProtectedCalls` type
(`authorization.test.ts` ~1962) is unenforced. `billing/*` and `preferences/update` are already
missing from it.

Owned files:
- `packages/testkit/src/authorization.test.ts`: a runtime assertion that the protected-call list
  equals the set of paths enumerated from `appContract` (walk nested objects until a node with
  `"~orpc"`); and that the intruder list (~223-436; a second signup is a genuine wrong tenant)
  covers every path minus an explicit, commented allowlist of resource-free endpoints. Add the
  missing entries the assertions reveal (at least `billing/status`, `billing/checkout`,
  `billing/portal`, `preferences/update`; billing paths return 401 unauthenticated and `NOT_FOUND`
  when billing is off).

Checkable behaviour: adding a procedure to `appContract` without an authorization entry fails the
suite.

Verification: `VERIFY_DATABASE=1 DATABASE_URL=... pnpm vitest run packages/testkit/src/authorization.test.ts`.

### Slice 4: tag usage made without a user credential

Prerequisites: none (rebase over slice 1 if it lands first; shares `executor.ts` and `team-chat-judge.ts`).

Owned files:
- `packages/db/prisma/schema.prisma` and a new migration under `packages/db/prisma/migrations/`
  (naming follows the existing `YYYYMMDD000000_name` folders): `UsageRecord.platformKey Boolean @default(false)`.
  No new index for the beta; the existing `(spaceId, userId, createdAt)` index serves the monthly
  sum by `spaceId` prefix (upgrade path: `(spaceId, platformKey, createdAt)` if the query shows up).
- `packages/adapter-kit/src/types.ts`: optional `platformKey?: boolean` on `AgentRunModel`. No
  runtime usage-event field is added and `pi-usage.ts` is not edited.
- `packages/db/src/usage.ts:5-13`: add `platformKey` to `UsageAttribution`; `recordUsage` persists
  `attribution.platformKey ?? false`.
- `packages/adapters/src/executor.ts`: `deploymentKeyFor` (`:9819`), the single choke point called at
  `:9875` and `:10002`, returns the key together with `platformKey: true` (made async if slice 5's
  needs require it; slice 5 adds the allowance check in the same function). `platformKey` means no
  user credential was used, including host-credential/Bedrock where the key is `undefined`. The
  model object carries it into the `recordUsage` attribution at the sites `:7630`, `:8140`, `:5171`.
- `apps/api/src/team-chat-judge.ts:231-233`: set `platformKey: true` where `deploymentModelKey` is used.
- Tests: `packages/db/src/usage.test.ts` (fake-prisma unit, existing pattern) asserts the column;
  `packages/testkit/src/usage-accounting.postgres.test.ts` gains one assertion that a run without a
  connected credential writes `platformKey = true` and a run with a connected credential writes
  `false`.

Checkable behaviour: every usage row says whether the operator paid for it. No user-visible change.

Verification: `pnpm --filter @rakazo/db generate && pnpm vitest run packages/db/src/usage.test.ts`; `VERIFY_DATABASE=1 DATABASE_URL=... pnpm vitest run packages/testkit/src/usage-accounting.postgres.test.ts`.

### Slice 5: monthly AI allowance with a hard stop

Prerequisites: slices 1 and 4.

Owned files:
- `packages/adapters/src/stripe-billing.ts`: one helper `billingAllowanceFromEnv(env)` next to
  `stripeBillingConfigFromEnv` reads optional `BILLING_AI_ALLOWANCE_USD` (non-negative finite
  number; malformed stops startup with a message naming the value; unset = no cap), unit-tested in
  `packages/adapters/src/stripe-billing.test.ts`. `apps/api/src/app.ts` and
  `apps/worker/src/index.ts` both call it (no duplicate parsing) and pass `allowanceUsdPerSeat`
  through `billing` into the executor. It is not part of the Stripe all-or-nothing check and is
  ignored when Stripe is not configured.
- `packages/db/src/billing.ts`: `platformSpendUsdThisMonth(prisma, organizationId)`, one SQL sum of
  `usage_records.costUsd` joined through `spaces.organizationId` where `platformKey` and
  `createdAt >= date_trunc('month', now() at time zone 'utc')`; `billingBlockReason` accepts a
  platform-key flag and returns `"allowance"` when the sum is at or over
  `seats x allowanceUsdPerSeat`.
- `packages/adapters/src/executor.ts`: the allowance check is inside or around `deploymentKeyFor`
  (the single choke point from slice 4), so both return sites (`:9875`, `:10002`) are covered and a
  user with their own credential continues.
- `apps/api/src/team-chat-judge.ts`: pass the platform-key flag to `billingBlockReason` (the judge
  always uses the deployment key).
- `.env.example` (next to the `STRIPE_*` lines at `:236-238`) and the Billing section of
  `docs/self-host.md:291-295`: document the value as optional; the amount itself is TBD.
- Tests: `packages/adapters/src/stripe-billing.test.ts` covers the env helper.
  `packages/db/src/billing.postgres.test.ts` adds spend-at-limit, spend-under-limit, rows
  with `platformKey = false` ignored, rows from another organization ignored, rows from last month
  ignored, `0` blocks the first platform call, and unset allowance never blocks.
  `packages/testkit/src/billing-enforcement.postgres.test.ts` adds: insert usage rows up to the cap,
  send a message, run fails with `Monthly AI allowance used. Connect a model in Settings to continue.`;
  connect a credential via `models/connect` with the model emulator, send again, run completes and
  its usage row has `platformKey = false`. Cross-organization case: spend in organization A never
  counts toward B's allowance.

Checkable behaviour: the allowance stops platform-key runs and triage; BYOK runs continue; usage with
`costUsd = null` counts as zero (open question 2).

Verification: `VERIFY_DATABASE=1 DATABASE_URL=... pnpm vitest run packages/db/src/billing.postgres.test.ts packages/testkit/src/billing-enforcement.postgres.test.ts`. Manual: set `BILLING_AI_ALLOWANCE_USD=0` locally with Stripe test keys, send a message, read the failed run; connect an OpenRouter key in Settings, send again.

### Slice 6: hosted bootstrap: designated operator

Prerequisites: none (rebase over slice 5 if it lands first; shares `apps/api/src/env.ts` and `app.ts`).

Background: with `SMTP_URL` set, `claimUnverifiedFirstAccount` is unreachable
(`packages/auth/src/index.ts` ~503-511 throws first), so no `packages/core` signup-policy change is
made.

Owned files:
- `packages/auth/src/index.ts`: `AuthEnv` (`:33`) gains `deploymentOwnerEmail?: string`. The session
  hook (~527-531) passes
  `{ claimDeploymentOwner: !env.deploymentOwnerEmail || user.email.toLowerCase() === env.deploymentOwnerEmail }`
  to `bootstrapUserSpace` (`packages/db/src/bootstrap-user.ts:28-34` already has the option).
- `apps/api/src/env.ts` and `apps/api/src/app.ts`: `DEPLOYMENT_OWNER_EMAIL` (optional, lowercased).
  API startup refuses when `DEPLOYMENT_OWNER_EMAIL` is set without `SMTP_URL` and `EMAIL_FROM`
  (without mailbox proof, anyone could sign up with the owner's address).
- `.env.example` and `docs/self-host.md` "Public single-VM deployment" env block (`:478-500`): the
  new value.
- Tests first: a new `VERIFY_DATABASE=1` describe block in `packages/testkit/src/journeys.test.ts`
  (precedent: sign-up ~2969, owner ~1816): a non-matching email never becomes owner; the matching
  email signing up second does. The startup refusal lives in `loadEnv` (`apps/api/src/env.ts`) and
  is tested in `apps/api/src/env.test.ts`. The `claimDeploymentOwner: false` case already exists at
  `packages/db/src/bootstrap-user.test.ts:112`.

Checkable behaviour: with `DEPLOYMENT_OWNER_EMAIL` set, the first stranger to sign up is an ordinary
member; the operator's own signup claims ownership; startup fails if mail is not configured. Unset
keeps today's first-signup behaviour for self-hosters.

Runbook note (slice 7): the operator signs up and verifies the mailbox before any other address goes
on `SIGNUP_ALLOWLIST`; Better Auth keeps an unverified row that would otherwise block the address.

Verification: `pnpm vitest run apps/api/src/env.test.ts`; `VERIFY_DATABASE=1 DATABASE_URL=... pnpm vitest run packages/testkit/src/journeys.test.ts`. Manual: two signups on the local stack with the value set; `deployment/get` is `FORBIDDEN` for the first, allowed for the operator.

### Slice 7: single-VM runbook with managed Postgres, E2B and S3

Prerequisites: slices 1-6 for the env values it documents (docs only; the overlay can land earlier).

Owned files:
- `infra/compose/docker-compose.prod.managed-postgres.yml` (new overlay, following the
  `docker-compose.prod.docker.yml` precedent): for `api` and `worker`, set only the two URL
  overrides, `DATABASE_URL: ${DATABASE_URL:?...}` and `REALTIME_DATABASE_URL` (the base file
  hardcodes the in-stack URL in `environment:`, `docker-compose.prod.yml:80,151`, and
  `environment` wins over `env_file`). No `depends_on` change. The in-stack `postgres` service stays
  defined but is not started: the runbook brings the stack up with
  `docker compose ... up -d --no-deps api worker web caddy`.
- `docs/hosted-service/deploy.md` (new): the ordered checklist. Host hardening
  (`infra/compose/harden-host.sh`), managed Postgres with pgvector, the env block (the existing
  public single-VM block at `docs/self-host.md:478-500` plus `STRIPE_*`,
  `BILLING_AI_ALLOWANCE_USD` (optional), `DEPLOYMENT_OWNER_EMAIL`, `SMTP_URL`, `EMAIL_FROM`,
  `SIGNUP_ALLOWLIST`, `SANDBOX_PROVIDER=e2b`, `E2B_API_KEY`, `SANDBOX_IDLE_MS`,
  `SANDBOX_MAX_COMPUTERS_PER_USER`, `SANDBOX_COMMAND_TIMEOUT_MS`, `MAX_TOOL_CALLS_PER_TURN`,
  `RAKAZO_S3_*`, `AXIOM_*`; and the values that must stay unset: `MCP_ALLOW_PRIVATE_ENDPOINT`,
  `RAKAZO_LOCAL_MODELS`, `CLOUD_AGENT_PROVIDER`, `MESSAGING_OPEN_SIGNUP`, `OIDC_ALLOW_SIGNUP_BYPASS`),
  Stripe webhook registration for `BILLING_WEBHOOK_PATH`, first deploy and health check, operator
  signup and verification before any other address is added to `SIGNUP_ALLOWLIST`, ownership check,
  backups (provider snapshots plus `pg_dump` against `DATABASE_URL`; `infra/compose/backup-prod.sh`
  targets the in-stack container and does not apply), upgrade and rollback, and what to watch:
  create an Axiom monitor on `level=error`, and Stripe webhook failures. States that
  `SANDBOX_MAX_COMPUTERS_PER_USER` applies only on restore, so the first computer per bot is
  unlimited (acceptable for an invite-only beta).
- `docs/self-host.md` "Public single-VM deployment": one paragraph linking to the runbook.
- `packages/testkit/src/compose.managed-postgres.test.ts` (new; skipped unless docker is available;
  precedent: `compose.backup.test.ts`, `deploy-script.test.ts`): one config-render test
  (`docker compose -f ... -f ... config`) proving the overlay resolves `DATABASE_URL` and
  `REALTIME_DATABASE_URL` from the environment for `api` and `worker`.

`infra/compose/deploy-main.sh` hardcodes `COMPOSE_FILE` to `docker-compose.prod.yml` (line 15) and
the updater reads `RAKAZO_COMPOSE_FILE` (`docs/self-host.md` ~828-833). The hosted beta deploys
manually with the documented `docker compose -f ... -f ... up -d --no-deps api worker web caddy`
command; the runbook does not use `deploy-main.sh` or the updater for this layout. No script change.

Checkable behaviour: an operator can bring up API, worker, web and Caddy on one VM against a managed
Postgres with no in-stack database, using only documented values.

Verification: `pnpm vitest run packages/testkit/src/compose.managed-postgres.test.ts` (needs docker), then a real deploy on a
fresh VM following the document; record what was exercised in the PR.

## Later phases (not slices)

- Public launch: pricing page, open self-serve signup (verification must then not depend on a
  non-empty allowlist, `packages/auth/src/index.ts:446`), team organization creation and invites,
  Google OAuth verification/CASA or Composio/Pipedream Gmail, data export, audit log, per-tenant
  worker fairness, a mobile paywall screen, an allowance meter in Settings.
- Sentry error sink: a `LogSink` posting `level: "error"` events to the Sentry envelope endpoint from
  `SENTRY_DSN` (about 40 lines in `packages/logging`, mirroring `createAxiomSink`), or `@sentry/node`
  if breadcrumbs or release tracking are wanted. Deferred because Axiom already covers errors.
- Scale: `DATA_DIR` fully on object storage, multiple API and worker processes, HA Postgres.

## Assumptions

1. Runs on the scripted runtime in tests resolve the model through `resolveModelKey` with a null
   credential (the deployment-key branch), so the enforcement tests can run offline against
   Postgres with no model key.
2. OpenRouter (the documented platform key, `docs/self-host.md:466`) reports per-call cost, so
   `costUsd` is `provider-reported` for platform usage (`packages/adapters/src/pi-usage.ts:65-78`).
3. The production Compose `.env` is shared by API and worker (`env_file: ../../.env`), so the
   worker sees `STRIPE_*` and `BILLING_AI_ALLOWANCE_USD` without Compose changes.
4. A paused E2B sandbox does not accrue compute charges (storage may).
5. The web `SubscriptionGate` stays as the only client-side paywall; desktop hosts the web UI.
6. Billing stays per organization; a user belongs to exactly one personal organization in the beta.

## Open questions

1. Allowance period: calendar month (chosen) versus the Stripe billing period.
2. Usage rows with `costUsd = null` count as zero; decide whether to estimate from tokens for the
   platform model at a fixed rate.
3. Cloud agents (Cursor) are unmetered; confirm `CLOUD_AGENT_PROVIDER` stays unset in hosting.
4. Trial allowance: same as paid (chosen) or a smaller trial pool.

Resolved during review: failure notifications (skipped for billing blocks, slice 1); authorization
list coverage (slice 3); sandbox wake without a run (slice 2); `depends_on: !reset` (dropped, slice 7);
`SANDBOX_MAX_COMPUTERS_PER_USER` at bot creation (restore only, accepted, runbook).

## Review record

- Decomposition review (Fable; Astra still unavailable): applied findings 1-9, 11, 12; finding 10 confirmed no change.

- The Astra plan review could not run: the Codex usage limit was reached until 2026-10-24, and it
  produced no findings.
- A fresh Fable reviewer was used instead. It returned 13 findings; the lead verified 1-3 in source.
  Applied:
  - Eight computer procedures wake or keep alive a paused sandbox without a run: new slice 2; the
    "a computer only wakes for a run" claim is removed; former open question 5 closed.
  - `exhaustiveProtectedCalls` is unenforced (tests excluded from `tsc`): slice 3 asserts it at
    runtime against `appContract`; cross-organization cases move into slice 5; former open question 2 closed.
  - `deploymentKeyFor` is returned from two branches: tag and allowance both go in or around it.
  - `platformKey` defined as "no user credential was used", not `Boolean(apiKey)`.
  - Tagging slice made smaller: `AgentRunModel` and `UsageAttribution` only, no runtime usage-event
    field, no `pi-usage.ts` edit.
  - `BILLING_AI_ALLOWANCE_USD` is optional and outside the Stripe all-or-nothing check.
  - Operator slice: the `packages/core` signup-policy change is cut (unreachable with SMTP set);
    owner gate in the session hook plus a startup refusal without SMTP; runbook ordering.
  - Sentry slice cut; replaced by an Axiom monitor runbook step; Sentry moved to Later phases.
  - Compose overlay reduced to the two URL overrides; `depends_on: !reset` dropped and
    `up -d --no-deps` used; former open question 7 closed.
  - Slice 1 tests trimmed to one `threads/send` plus one routine wake; `ExecutorDeps.billing`
    presence is the flag.
  - Failure notifications skipped for `BillingBlockedError`; former open question 1 decided.
  - `SANDBOX_MAX_COMPUTERS_PER_USER` is enforced on restore only; accepted for the beta and stated
    in the runbook; former open question 9 answered.

## Evidence index

- `packages/db/src/billing.ts:6-10` `hasBillingAccess`; `:72-78` `organizationSeatCount`; `:80-97` `organizationForMember`.
- `apps/api/src/billing.ts:82-96` owner bypass; `:118-143` checkout with `TRIAL_DAYS`.
- `apps/api/src/router.ts:1185-1188` `authed` checks actor only; `:7830` `billingEnabled`; `:7834` `requireBilling`; computer procedures ~2946 (`boot`; fix ~2309), ~3400-3624 (`files`, `readFile`, `downloadFile`, `uploadFile`, `terminalUrl`, `screenUrl`, `heartbeat`).
- `packages/adapters/src/e2b-sandbox.ts:37-43` pause lifecycle; ~109 `box()` and E2B `connect`.
- `packages/adapters/src/executor.ts:3395` `continueRun`; `:3946-3976` model selection and `failRunBeforeModel`; `:4019-4035` terminal setup errors; `:9819` `deploymentKeyFor`; `:9831` `resolveModelKey`; `:9875`, `:9999-10002` deployment-key return sites; `:7630`, `:8140`, `:5171` `recordUsage` sites.
- `packages/adapters/src/deployment-model.ts` ~44-50 host-credential/Bedrock path (key undefined).
- `packages/adapters/src/background-job-handlers.ts:97-98` the `run.continue` handler.
- `packages/db/src/usage.ts:5-13` `UsageAttribution`; `:16` `recordUsage`; `schema.prisma` model `UsageRecord`.
- `packages/db/src/computers.ts` ~102,128 computer quota on restore.
- `packages/auth/src/index.ts:194` `claimUnverifiedFirstAccount`; `:418-446` signup gate; `:503-531` session hook and `bootstrapUserSpace` call.
- `packages/db/src/bootstrap-user.ts:28-34,101-107` owner claim option.
- `packages/db/src/scope.ts:42` `isDeploymentOwner` derivation.
- `packages/logging/src/axiom.ts:44-83` env sink and `createRootLogger`; `types.ts:30` `LogSink`.
- `packages/testkit/src/authorization.test.ts:33-35` database gate; `:223` intruder; `:771` space boundary; ~1962 `exhaustiveProtectedCalls`; `packages/testkit/tsconfig.json` excludes `src/**/*.test.ts`.
- `apps/web/src/components/SubscriptionGate.tsx:44-54` client paywall; `apps/web/src/pages/Paywall.tsx:48` title.
- `infra/compose/docker-compose.prod.yml:80,104-106,151,172-174` database wiring and dependencies.
