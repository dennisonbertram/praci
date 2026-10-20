#!/usr/bin/env bash
# Builds the app, updater and computer images from this checkout with local tags
# (praci/app:local, praci/updater:local, praci/computer:local) for the desktop's
# self-contained mode. See docs/desktop-release.md ("Self-contained local build").
set -euo pipefail
cd "$(dirname "$0")/.."
platform="${PRACI_IMAGE_PLATFORM:-linux/$(uname -m | sed 's/x86_64/amd64/;s/aarch64/arm64/')}"
tag="${PRACI_IMAGE_TAG:-local}"
sha="$(git rev-parse HEAD 2>/dev/null || echo local)"
docker build --platform "$platform" -f infra/compose/Dockerfile --build-arg "GIT_SHA=$sha" -t "praci/app:$tag" .
docker build --platform "$platform" -f infra/updater/Dockerfile -t "praci/updater:$tag" .
docker build --platform "$platform" -f infra/sandboxes/computer/Dockerfile -t "praci/computer:$tag" infra/sandboxes/computer
docker images --format '{{.Repository}}:{{.Tag}}  {{.Size}}' | grep "^praci/"
