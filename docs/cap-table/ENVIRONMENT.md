# Local development environment

The repository's demo stack provides an isolated app, Postgres database, and invented sample
data. It does not require a real account or third-party credentials.

```sh
pnpm install --frozen-lockfile
pnpm --filter @rakazo/db generate
DEMO_SLOT=0 pnpm demo:up
```

Open the web URL and use the seeded login printed by `demo:up`. Stop the stack when finished:

```sh
DEMO_SLOT=0 pnpm demo:down
```

For focused database tests, follow the repository's `packages/testkit` setup and the test file's
documented environment requirements. Keep test data synthetic and use separate migration-owner
and runtime database credentials when a test exercises row-level security.
