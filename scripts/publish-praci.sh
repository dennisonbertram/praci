#!/usr/bin/env bash
# Publish a reviewed local snapshot to a candidate branch in the public Praci repo.
set -euo pipefail
cd "$(git rev-parse --show-toplevel)"
readonly PRACI_URL="https://github.com/dennisonbertram/praci.git"
readonly PRACI_MAIN="refs/remotes/praci/main"

if [ "$#" -ne 1 ] || [[ "$1" != refs/heads/* ]]; then
  echo "Usage: scripts/publish-praci.sh refs/heads/<privacy-reviewed-snapshot>" >&2
  echo "Pass a local snapshot branch after privacy review; this script never selects origin/main." >&2
  exit 2
fi
snapshot_ref="$1"
if ! git check-ref-format "$snapshot_ref" || ! git show-ref --verify --quiet "$snapshot_ref"; then
  echo "Snapshot ref must name an existing local branch: $snapshot_ref" >&2
  exit 2
fi
snapshot_commit="$(git rev-parse --verify "${snapshot_ref}^{commit}")"

# Fetch only the pinned public target. Do not use the checkout's configured remotes.
git fetch -q "$PRACI_URL" "+refs/heads/main:$PRACI_MAIN"
public_main="$(git rev-parse --verify "${PRACI_MAIN}^{commit}")"
read -r -a commit_fields <<< "$(git rev-list --parents -n 1 "$snapshot_commit")"
if [ "${#commit_fields[@]}" -ne 2 ] || [ "${commit_fields[1]}" != "$public_main" ]; then
  echo "Snapshot must be a single-parent commit directly on fetched public main ($public_main)." >&2
  exit 1
fi
if git diff --quiet "$public_main" "$snapshot_commit" --; then
  echo "Snapshot contains no changes relative to public main." >&2
  exit 1
else
  diff_status=$?
  if [ "$diff_status" -ne 1 ]; then
    echo "Could not compare the snapshot with public main." >&2
    exit "$diff_status"
  fi
fi
range="$public_main..$snapshot_commit"

gitleaks git --log-opts="$range" --redact

# Local checkout paths in the tree being published (container paths like /home/rakazo are fine).
if git grep -nIE '/Users/[A-Za-z]' "$snapshot_commit" -- . ':!*.lock' | grep -vE '/Users/(you|name|me|example|user|username)\b'; then
  echo "local paths found in the reviewed snapshot; fix before publishing" >&2
  exit 1
fi

snapshot_short="$(git rev-parse --short=12 "$snapshot_commit")"
candidate_ref="refs/heads/review/snapshot-$snapshot_short"
git -c push.followTags=false push --no-follow-tags "$PRACI_URL" "$snapshot_commit:$candidate_ref"
echo "Pushed reviewed snapshot to $candidate_ref. Open a PR targeting main after review."
