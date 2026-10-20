# Desktop releases

The `release-desktop` workflow builds, signs, notarizes, attests, and publishes
the Electron app from a `vMAJOR.MINOR.PATCH` tag on `main`. Publishing the
Docker images triggers from the same tag.

## Repository secrets

macOS (required):

| Secret | Value |
| --- | --- |
| `DESKTOP_MAC_CSC_LINK` | Base64 of the `Developer ID Application` certificate exported as `.p12` |
| `DESKTOP_MAC_CSC_KEY_PASSWORD` | Password used when exporting the `.p12` |
| `APPLE_API_KEY_ID` | App Store Connect API key ID (the `XXXXXXXXXX` in `AuthKey_XXXXXXXXXX.p8`) |
| `APPLE_API_ISSUER` | Issuer ID shown on App Store Connect > Users and Access > Integrations |
| `APPLE_API_KEY_P8` | Contents of the `AuthKey_*.p8` file |

The API key needs the Developer role. The workflow writes it to a mode 600 file
in the runner's temp directory for the packaging step and deletes it afterwards.

`patches/app-builder-lib@26.15.3.patch` carries electron-builder PR #10101:
without it `CSC_LINK` signing fails while creating the temporary keychain. Drop
the patch once an electron-builder release includes that fix.

Windows (optional):

| Secret | Value |
| --- | --- |
| `DESKTOP_WIN_CSC_LINK` | Base64 of the Authenticode certificate as `.p12`/`.pfx` |
| `DESKTOP_WIN_CSC_KEY_PASSWORD` | Its password |

When `DESKTOP_WIN_CSC_LINK` is unset the Windows build and its release assets
are skipped. macOS and Linux always build, and the release is only published
when every platform that was built produced its installer and update feed.

Set a secret from a file without echoing it:

```sh
base64 -i devid.p12 | gh secret set DESKTOP_MAC_CSC_LINK
gh secret set APPLE_API_KEY_P8 < AuthKey_XXXXXXXXXX.p8
```

## Cut a release

1. Bump `version` in `apps/desktop/package.json` on `main`.
2. Tag that commit `v<version>` and push the tag:

```sh
git tag v0.1.1
git push origin v0.1.1
```

The workflow refuses tags that do not match the desktop version, are not on
`main`, or are not newer than the latest published release.

## Self-contained local build

A normal build pulls `ghcr.io/elie222/rakazo/*` images pinned to its own version. To
run Praci fully from this checkout instead, build the images locally and bake their
names into the app:

```sh
pnpm desktop:images                   # praci/app, praci/updater, praci/computer at :local
pnpm --filter @rakazo/desktop pack:local   # unsigned app in apps/desktop/out/mac-arm64
```

`pack:local` writes `rakazoStackImages` (`image`, `computerImage`, `tag`, `local`) into
the packaged `package.json` with `-c.extraMetadata`. When it is present, "This
computer" passes those refs to Compose as `RAKAZO_IMAGE` and `RAKAZO_COMPUTER_IMAGE`
and the tag as the stack tag. With `local: true` the app skips `compose pull` and runs
`compose up --pull never`, so the images must already exist in the local Docker.
Builds without the field are unchanged. `RAKAZO_IMAGE_TAG` at launch still overrides
the tag. The image builds use the host architecture (set `PRACI_IMAGE_PLATFORM` to
change it). The stack uses the `rakazo-desktop` Compose project and its own volumes,
and port 45173 by default, so it does not touch a `pnpm dev` stack.
