---
name: electron-cloud
description: Launch and test Praci Electron in an isolated cloud development environment, distinguish mocked checks from real-stack and packaged-app coverage, and collect reproducible evidence.
---

# Electron cloud development and verification

Read root `AGENTS.md` first. Use this skill when preparing a cloud desktop,
debugging Electron startup, or verifying desktop changes. All commands below
run from the task's repository root unless stated otherwise. Use a dedicated
worktree, not another agent's checkout. The executable examples use Bash on
Linux; do not copy Linux display commands into macOS or Windows instructions.

This is a runbook, not an assertion that the environment or app already passes.
Check the current scripts and record what actually ran. The proposed commands
`desktop:doctor`, `desktop:cloud:up`, and `desktop:cloud:down` do **not** exist;
do not invoke them or report their proposed acceptance checks as implemented.

## 1. Establish ownership and prerequisites

- Record the commit, working-tree changes, OS/architecture and intended test
  tier. Never switch another running test's revision underneath it.
- Inspect existing processes, demo slots and containers before starting
  anything. Reuse only a stack you own whose revision and configuration match.
  Never kill a process simply because it occupies the desired port.
- Run as an unprivileged user. Keep Electron's sandbox and renderer isolation
  enabled; do not work around startup errors with `--no-sandbox`.
- Use Node 24 and repository-pinned pnpm through Corepack. Compare plain
  `pnpm --version` with `corepack pnpm --version`: nested repository scripts
  invoke plain pnpm, so a mismatched PATH/shim must be corrected first.

```bash
git status --short
git rev-parse HEAD
node --version
corepack pnpm --version
pnpm --version
docker info >/dev/null
docker compose version
df -h .
corepack pnpm install --frozen-lockfile
DATABASE_URL=postgresql://synthetic:synthetic@127.0.0.1:5432/synthetic \
  corepack pnpm --filter @rakazo/db generate
corepack pnpm --filter @rakazo/desktop exec electron --version
```

The database URL above is only for generating Prisma code, **not** a live test
database. Do not run migrations against it or reuse a real database.

On Linux, verify Electron's required GTK/NSS/audio/graphics libraries and fonts,
the downloaded Electron binary, Docker daemon access, and sufficient memory
and disk for the selected tier. Use the installed Electron version's dependency
requirements; do not add an unverified list of OS packages to a shared blueprint.
For visible testing, check `DISPLAY` and `xdpyinfo`. For isolated automated
checks, check `xvfb-run` and use a separate virtual display. A virtual display
does not prove native window-manager behavior such as actual window dragging.

Put verified tool/dependency installation in the environment blueprint or the
equivalent setup configuration for the agent platform. Start services only at
runtime: running processes do not survive creation of a fresh snapshot. Report
the exact missing prerequisite instead of claiming a partial bootstrap worked.

## 2. Start an isolated, no-paid-services development stack

Use `packages/testkit/src/cli/demo.ts`, not hand-seeded production data. It
creates a real disposable Postgres database and an emulated API/web stack with
invented records. It does **not** prove production worker, provider or sandbox
behavior. Its normal mode can discover real model keys, including from a local
development environment file; merely unsetting shell keys is insufficient.

For a safe baseline, explicitly select `DEMO_NO_MODEL=1` and remove inherited
model keys. This seeds the **no-model** state: do not claim a real or emulated
model-reply journey passed using it. A richer deterministic model mode must be
separately verified before use; live integrations require explicit approval.

Choose an unused slot from 0–9 and export it, for example `export DEMO_SLOT=3`
only after checking availability. Slot ports are Postgres `5450 + slot`, API
`3300 + slot`, and web `5373 + slot`. Check all three ports, Docker names/labels
and the worktree's `.demo` state. Coordinate with other agents: checking free
ports is not an atomic reservation. `demo:up` can tear down an unhealthy
existing stack recorded in that slot; never point it at another run's state.

```bash
# DEMO_SLOT must already identify a free slot assigned to this run.
: "${DEMO_SLOT:?Choose and reserve a free demo slot first}"
env -u OPENROUTER_API_KEY -u ANTHROPIC_API_KEY \
  DATABASE_URL=postgresql://synthetic:synthetic@127.0.0.1:5432/synthetic \
  DEMO_NO_MODEL=1 DEMO_SLOT="$DEMO_SLOT" corepack pnpm demo:up
export DEMO_API_URL="http://127.0.0.1:$((3300 + DEMO_SLOT))"
export DEMO_WEB_URL="http://127.0.0.1:$((5373 + DEMO_SLOT))"
curl --fail --silent --show-error --max-time 10 "$DEMO_API_URL/health" >/dev/null
curl --fail --silent --show-error --max-time 10 "$DEMO_WEB_URL" >/dev/null
```

The placeholder URL lets the root script generate Prisma code; the demo launcher
replaces it with the slot's disposable database before migrations and seeding.
Startup already waits for readiness and seeds the account. Use its local login
file privately; never attach credentials, environment dumps or raw auth traces.
If startup fails, inspect the slot's API/web logs and repair the smallest cause.
Do not reset another database or mask failed migrations with manual table edits.

Build and launch Electron against that exact web origin in a separate foreground
terminal. Set the same `DEMO_SLOT` in that terminal first; shell exports do not
transfer between existing terminals. Keep the generated profile path in the
owning shell for cleanup:

```bash
: "${DEMO_SLOT:?Set this to the slot started above}"
export DEMO_WEB_URL="http://127.0.0.1:$((5373 + DEMO_SLOT))"
export DESKTOP_PROFILE="$(mktemp -d)"
corepack pnpm --filter @rakazo/desktop build
RAKAZO_WEB_URL="$DEMO_WEB_URL" \
  RAKAZO_PERFORMANCE_USER_DATA="$DESKTOP_PROFILE" \
  RAKAZO_DISABLE_AUTO_UPDATE=1 \
  corepack pnpm --filter @rakazo/desktop exec electron .
```

Confirm the real Electron window, login, and visible target feature. A browser
tab showing the same URL is not an Electron check. `RAKAZO_WEB_URL` bypasses the
first-run server chooser: this recipe does **not** test "This computer" setup.
For chooser tests unset that override and use a fresh isolated profile.

## 3. Choose the test tier and state its limits

### A. Fast desktop checks

```bash
corepack pnpm --filter @rakazo/desktop check
corepack pnpm --filter @rakazo/desktop test
# Dedicated Linux cloud machine only; never routinely on a maintainer's desktop.
xvfb-run --auto-servernum corepack pnpm --filter @rakazo/desktop test:e2e
```

Read `apps/desktop/e2e/playwright.config.ts` and the affected specs. The smoke and
drag specs use HTML fixtures; setup uses a stub server; local-stack tests use a
fake Docker CLI. These are valuable security/setup/control checks, **not** proof
of a full application, real Docker startup, or actual native window dragging.
Do not describe passing fixture tests as full desktop coverage.

### B. Full application journeys in Electron

Use the development stack above for applicable workflows: sign-in, navigation,
Data room, attachments, settings, persistence after app relaunch, and isolation
between invented users/spaces. Exercise chat's no-model state in the safe
baseline; use a verified scripted harness for successful replies. Cover loading,
empty/error states, light/dark appearance and the relevant window sizes.

Use existing shared web journeys where they genuinely apply, but drive Electron
for its preload, clipboard, dialogs, downloads, links and window lifecycle.
Introduce no production credentials or external writes for synthetic tests.
Check backend restart/reconnect and interrupted startup using only owned
processes. A workflow with fake providers is not verification of real OAuth,
email delivery, paid sandboxes or the production job topology.

### C. Packaged application and real "This computer" stack

This tier is slower and requires Docker image builds, sufficient disk, and
exclusive ownership of the desktop Compose project. Read
`docs/desktop-release.md` and `scripts/build-desktop-images.sh` first.

The existing `pack:local` script is **macOS-only**. For Linux, the equivalent
build steps use the existing builder with local-image metadata explicitly:

```bash
env -u PRACI_IMAGE_PLATFORM PRACI_IMAGE_TAG=local corepack pnpm desktop:images
corepack pnpm --filter @rakazo/web build
corepack pnpm --filter @rakazo/desktop build
corepack pnpm --filter @rakazo/desktop exec electron-builder --linux --dir \
  --publish never \
  -c.extraMetadata.rakazoStackImages.image=praci/app \
  -c.extraMetadata.rakazoStackImages.computerImage=praci/computer \
  -c.extraMetadata.rakazoStackImages.tag=local \
  -c.extraMetadata.rakazoStackImages.local=true
```

Locate the resulting executable under the desktop build output; do not assume
an architecture-specific directory or substitute `electron .`. Assert
`app.isPackaged` using Electron automation, and record the artifact and source
revision. In particular, `perf:desktop` currently falls back to the development
Electron executable on Linux; that fallback is not packaged-app evidence.

Unset `RAKAZO_WEB_URL`, `RAKAZO_LOCAL_WEB_URL`, `RAKAZO_DOCKER_BINARY` and
`RAKAZO_IMAGE_TAG` overrides for this local-image scenario. Use a fresh isolated
profile and disable auto-updates. Choose "This computer" through the real UI,
check the actual containers' health, and complete an application journey.
The local-image metadata avoids pulling unrelated published release images.
Never run release, publish, signing or production-update commands for this test.

The desktop stack uses the shared Compose project name `rakazo-desktop`, unlike
slot-isolated demo stacks. A separate Electron profile alone does not isolate
that project. Stop if another run owns it; never run competing real-stack tests
or remove its volumes. Record the exact resources created by this run.

## 4. Cold-start acceptance and evidence

A claim of reliable cloud setup requires a fresh worktree/environment with no
task-specific files or inherited login profile. Record, for each tested tier:

1. Preflight, dependency setup, migrations and readiness succeed.
2. The intended Electron binary launches the intended revision/backend.
3. At least one real user journey succeeds, then survives app relaunch.
4. An owned backend outage produces a recoverable state rather than a blank app.
5. Owned processes, containers, profiles and temporary downloads are cleaned up.
6. The same procedure succeeds again with a fresh profile and test database.

Capture a concise manual recording plus screenshots, automated results and
failure traces/logs. Record OS, Node/pnpm/Electron versions, commit, launch mode,
test tier, model mode and excluded workflows. Sanitize all artifacts before
attaching them. Check recording exports actually include the exercised states;
do not use an old run as evidence for newly changed code. Do not put generated
recordings, private paths or local credentials in the repository.

The current suite retains failure traces/screenshots and writes setup screenshots;
check where the runner puts them. Attach them explicitly rather than assuming
CI uploads every artifact. CI may be disabled: "no checks" is not a green run.
Apply the repository's normal merge gates and PR-watch rules separately.

## 5. Cleanup and platform boundaries

Close only the Electron process owned by this run. From the same worktree and
with the same slot used at startup:

```bash
: "${DEMO_SLOT:?Use the slot owned by this run}"
DEMO_SLOT="$DEMO_SLOT" corepack pnpm demo:down
```

Remove only the temporary profile created by this run after Electron exits.
For a real desktop stack, inspect its generated Compose configuration and verify
resource ownership before shutting it down and deleting its throwaway volumes.
Never use global Docker pruning, broad process killing or deletion of a user's
normal app profile. Always release any paid test resources. Keep a development
stack running only when explicitly handing it over, with ownership documented.

Linux verifies Linux/shared behavior. macOS and Windows require their own native
runs for installers, permissions, menus, deep links and update behavior. Use
separate approved native machines; do not simulate an OS with CSS and call it
native verification. Signed updates and real integrations need separately
authorized test infrastructure. Report those gaps rather than claiming the
entire cross-platform product is tested.

## Follow-up tooling, not yet supplied by this skill

- A preflight/one-command cloud launcher with readiness, slot ownership and cleanup.
- An explicit credential-isolated deterministic model mode for full chat journeys.
- An automated real-Docker packaged Linux acceptance lane with no executable fallback.
- Standard sanitized evidence bundles and a macOS/Windows acceptance matrix.

Implement and verify these as separate changes; this skill documents how to use
current entry points and how to judge their evidence, not new application tooling.
