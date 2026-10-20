# Open-sourcing as Praci: plan

Status: a visible-only rename (product name in the UI, docs and site) has landed. The code identifier rename (packages, env vars, database and volume names, native modules) is still to do. Written 2026-10-19 against `main` at `13dd1fcff`. Counts below are from
that commit and will drift.

This fork will be published as an open-source project under a new name, **Praci**. The name comes
from Czech *práci*, an inflected form of *práce* ("work"), as in *v práci* ("at work"). There is no
deadline. Day-to-day work continues in this repository unchanged until the rename lands.

## Decisions

- **Name:** Praci.
- **Domains:** `praci.ai`, `praci.dev` and `praci.app` are registered, with auto-renew on. None has
  DNS records or a deployment yet. `praci.com` and `praci.io` belong to someone else.
- **Repository:** a separate public `praci` repository, added to this checkout as one more Git
  remote. Work stays here; publishing is a `git push` of `main` to that remote.
- **Upstream:** `elie222/rakazo` stays a fetch-only remote so upstream fixes can still be merged.
- **History:** the full history is published. It is already public on the fork, and it is how
  upstream contributors keep authorship credit.

## Why the rename happens here, not in the public copy

If only the public copy were renamed, every sync would have to re-run the rename and resolve its
conflicts. Renaming once in this repository makes the public repository an exact mirror of `main`.

The cost is that `main` must stay publishable. Private material, such as hosting configuration,
billing details, or documents built from real data, must stay out of `main`. Otherwise every push
would need a filtering step.

## License and attribution

Upstream is Apache-2.0, which allows redistribution, modification and renaming under these
conditions:

- Keep `LICENSE` unchanged, including its line "Copyright 2026 Rakazo contributors", and keep
  existing copyright notices (sections 4a and 4c).
- Modified files must carry prominent notices that they were changed (section 4b). We meet this
  with a `NOTICE` file stating that the files were modified from Rakazo. That is our reading of
  4b, not its wording.
- Do not use upstream's trademarks (section 6), except to describe where the code came from. This
  is the main reason for a new name, and why "Rakazo" must not remain in product copy, package
  names, bundle IDs or domains.

Upstream has no `NOTICE` file, so section 4d adds nothing. Add a `NOTICE` and one README line
stating that Praci is derived from Rakazo by the Rakazo contributors under Apache-2.0. After the
rename, "Rakazo" should remain only in `LICENSE`, `NOTICE`, `CHANGELOG.md` history and that README
line.

## Work

### 1. Privacy pass

Do this before anything else is pushed under the new name.

- `docs/ux-paths/catalog.md` and the `dataroom`, `finance` and `inbox` catalogs contain an absolute
  local checkout path. Replace it with repo-relative paths. The path stays in history, which is
  already public on the fork.
- `gitleaks git` reports between 36 and 45 hits, depending on which refs are scanned. They are in
  test files, example env files, `packages/testkit/src/cli/evals.ts` and `curl --user` lines in
  `infra/compose/*.yml`, and all look like fixtures or false positives. Re-run on `main` only
  (`gitleaks git --log-opts=origin/main`), confirm each hit, and add confirmed fixtures to a
  `.gitleaksignore`.
- Read the finance, data-room and mockup documents for real figures, real names or real email
  content. Replace anything found with invented values. If something real is in history, stop and
  decide whether to rewrite history before publishing.

### 2. Choose the GitHub owner

The rename needs the new owner and repository path, so this comes first. The organization name
`praci` is taken by an empty organization.

### 3. Rename in this repository

"Rakazo" appears about 9,100 times across about 1,900 files, and 25 file or directory names contain
it. Do it as one PR. A blind `s/rakazo/praci/` is wrong in places: `elie222/rakazo` would become
`elie222/praci`, which does not exist. Review the non-mechanical rows below by hand.

| Area | Current | Change |
| --- | --- | --- |
| npm scope | `@rakazo/*` in 21 `package.json` files | `@praci/*`. The npm scope is not yet reserved; check it first. |
| Environment variables | `RAKAZO_*` | `PRACI_*`. No compatibility shim: there are no outside users yet. |
| Upstream repository path | `elie222/rakazo` in 44 files: electron-builder `publish` in `apps/desktop/package.json`, owner assertions in `.github/workflows/release-desktop.yml` and its test, `packages/core/src/self-update.ts`, `packages/core/src/compose-update.ts`, `infra/compose/install-images.sh`, `apps/www/src/site.ts`, `README.md` | The new owner and repository. Left alone, a Praci server or desktop app updates from upstream and installs upstream's scripts. |
| Container images | `ghcr.io/elie222/rakazo/{app,computer,updater}` in the compose files and env examples | Images published under the new owner. |
| Mobile app identity | `com.rakazo.app`; Expo owner `inbox-zero`, its `projectId` and the `updates.url` built from it in `apps/mobile/app.json` | New bundle ID under a Praci domain (for example `ai.praci.app`) and a new Expo project owned by us. The current Expo owner is upstream's account. |
| Native modules | `apps/mobile/modules/rakazo-*`, `com.rakazo.notifications`, Swift and Kotlin class names | Rename directories, packages and classes. |
| Desktop | `Rakazo.app`, app ID, deep-link scheme | Rename. Check that auto-update points at our releases, not upstream's. |
| Domains | about 114 references to `rakazo.com` | Point to Praci domains or remove. These belong to upstream, so any download or update URL left behind would serve upstream's builds. |
| Examples | `rakazo.example.com` | `praci.example.com`. |
| Product copy and docs | "Rakazo" | "Praci", except in the places listed under License and attribution. |
| Contacts | `security@`, `support@` and a personal address at `rakazo.com` in `SECURITY.md`, `CONTRIBUTING.md` and `.github/ISSUE_TEMPLATE/config.yml` | A working mailbox on a Praci domain, or GitHub private vulnerability reporting. It must exist before the first public push. |

Add a check to the rename PR that fails on any remaining `rakazo` or `elie222` outside the
attribution files.

Renaming the stack loses existing data unless it is migrated. Compose project names prefix volume
names (`name: rakazo` in `infra/compose/docker-compose.images.yml`, `rakazo-prod`, and
`rakazo-desktop` in `apps/desktop/src/local-stack.ts`). Postgres reads `POSTGRES_DB` and
`POSTGRES_USER` only on first start, and the Electron data directory follows the app name. After a
plain rename, an existing install starts with empty volumes and a missing database. Either keep the
old project, volume and database names, or document a dump-and-restore. Decide which in the rename
PR, and test the upgrade from a Rakazo-named install.

Smaller changes for an existing install:

- `.env` files and any service manager job that sets `RAKAZO_*` variables.
- Browser storage keys, cookies and OS keychain service names. Users stay signed in only if these are
  migrated. For a single-user install, signing in again once is acceptable.

### 4. Repository hygiene

- Remove the fork-specific rules from `AGENTS.md`: the PR target and the `origin`/`upstream`
  description. Keep `upstream` as a fetch-only remote.
- Update `README.md` for a reader with no context, and `CONTRIBUTING.md`.
- Before turning GitHub Actions on in the public repository, remove the deploy job for upstream's
  hosted app and the Expo OTA step from `.github/workflows/ci.yml`, and create the secrets and
  variables the remaining workflows need (`EXPO_TOKEN`, `S3_*`, release signing). Otherwise `main`
  goes red.

### 5. Publish

`dennisonbertram/praci` is public and holds the full history of `main`. It only receives `main` from
`scripts/publish-praci.sh`, which fetches both repositories, runs gitleaks over the new commits and
a local-path grep, then pushes `origin/main` to `praci/main` and the tags without forcing. Reviewed
fixture hits are listed in `.gitleaksignore`; add a fingerprint there only after confirming the hit
is not a real secret. GitHub Actions is disabled on the praci repository.

1. Create the public `praci` repository under the owner chosen in step 2.
2. Add it as a remote and push `main` and the release tags. The updater refuses a repository with
   no release tags (`infra/updater/src/index.ts`).
3. Cut a first release and publish the container images under the new path.
4. Point the domains at the marketing site (`apps/www`) and the docs.

## Open questions

- Trademark search for "Praci" in software classes (USPTO, EUIPO): TBD.
- GitHub owner for the public repository: TBD (needed before step 3).
- Keep or migrate the old volume and database names: TBD.
- Whether the fork `dennisonbertram/rakazo` is archived after the public repository exists: TBD.
