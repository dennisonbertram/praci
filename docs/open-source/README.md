# Open-sourcing as Praci: plan

Status: plan, not started. Written 2026-10-19 against `main` at `13dd1fcff`. Counts below are from
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

- Keep `LICENSE` unchanged and keep existing copyright notices (section 4a and 4c).
- Mark modified files (section 4b). A `NOTICE` file and the changelog cover this at project level.
- Do not use upstream's trademarks (section 6). This is the main reason for a new name, and why
  "Rakazo" must not remain in product copy, package names, bundle IDs or domains.

Add a `NOTICE` file and one README line stating that Praci is derived from Rakazo by Elie Steinbock
and contributors under Apache-2.0. These are the only places "Rakazo" should remain.

## Work

### 1. Privacy pass

Do this before anything else is pushed under the new name.

- `docs/ux-paths/catalog.md` and the `dataroom`, `finance` and `inbox` catalogs contain an absolute
  local checkout path. Replace it with repo-relative paths.
- `gitleaks git` over the full history reports 45 hits. All are in test files, `.env.example` or
  `infra/compose/.env.images.example`, and look like fixtures. Confirm each one and add confirmed
  fixtures to a `.gitleaksignore`.
- Read the finance, data-room and mockup documents for real figures, real names or real email
  content. Replace anything found with invented values. If something real is in history, stop and
  decide whether to rewrite history before publishing.

### 2. Rename in this repository

"Rakazo" appears about 8,700 times across about 1,800 files. Do it as one mechanical PR, with the
non-mechanical parts below reviewed by hand.

| Area | Current | Change |
| --- | --- | --- |
| npm scope | `@rakazo/*` in 21 `package.json` files | `@praci/*`. The npm scope is not yet reserved; check it first. |
| Environment variables | `RAKAZO_*` | `PRACI_*`. No compatibility shim: there are no outside users yet. |
| Mobile app identity | `com.rakazo.app`; Expo owner `inbox-zero` and its `projectId` in `apps/mobile/app.json` | New bundle ID under a Praci domain (for example `ai.praci.app`) and a new Expo project owned by us. The current Expo owner is upstream's account. |
| Native modules | `apps/mobile/modules/rakazo-*`, `com.rakazo.notifications`, Swift and Kotlin class names | Rename directories, packages and classes. |
| Desktop | `Rakazo.app`, app ID, deep-link scheme | Rename. Check that auto-update points at our releases, not upstream's. |
| Domains | about 114 references to `rakazo.com` | Point to Praci domains or remove. These belong to upstream, so any download or update URL left behind would serve upstream's builds. |
| Examples | `rakazo.example.com` | `praci.example.com`. |
| Product copy and docs | "Rakazo" | "Praci", except in `NOTICE` and the attribution line. |

Things that change for an existing local install:

- `.env` files and any service manager job that sets `RAKAZO_*` variables.
- The Postgres database name, object-storage bucket and container names.
- Browser storage keys, cookies and OS keychain service names. Users stay signed in only if these are
  migrated, or they sign in again once. For a single-user install, signing in again is acceptable.

### 3. Repository hygiene

- Remove the fork-specific rules from `AGENTS.md`: the PR target and the `origin`/`upstream`
  description. Keep `upstream` as a fetch-only remote.
- Update `README.md` for a reader with no context, plus `CONTRIBUTING.md` and the reporting contact
  in `SECURITY.md`.
- Turn GitHub Actions back on in the public repository so outside pull requests get CI.

### 4. Publish

1. Create the public `praci` repository. The GitHub organization name `praci` is taken by an empty
   organization, so pick another owner.
2. Add it as a remote and push `main`.
3. Point the domains at the marketing site (`apps/www`) and the docs.

## Open questions

- Trademark search for "Praci" in software classes (USPTO, EUIPO): TBD.
- GitHub owner for the public repository: TBD.
- Whether the fork `dennisonbertram/rakazo` is archived after the public repository exists: TBD.
