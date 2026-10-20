#!/usr/bin/env bash
# Publish origin/main to the public praci repo. Never forces, never pushes other branches.
set -euo pipefail
cd "$(git rev-parse --show-toplevel)"
PRACI_URL=https://github.com/dennisonbertram/praci.git
git remote get-url praci >/dev/null 2>&1 || git remote add praci "$PRACI_URL"
git fetch -q origin
git fetch -q praci main
range="refs/remotes/praci/main..refs/remotes/origin/main"
if [ -z "$(git rev-list "$range")" ]; then echo "praci/main is already up to date"; exit 0; fi

gitleaks git --log-opts="$range" --redact

# Local checkout paths in the tree being published (container paths like /home/rakazo are fine).
if git grep -nIE '/Users/[A-Za-z]' refs/remotes/origin/main -- . ':!*.lock' | grep -vE '/Users/(you|name|me|example|user|username)\b'; then
  echo "local paths found in origin/main; fix before publishing" >&2; exit 1
fi

git push praci refs/remotes/origin/main:refs/heads/main
git push praci --tags
