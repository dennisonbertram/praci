#!/usr/bin/env bash
set -euo pipefail

if [[ "$(uname -s)" != "Darwin" ]]; then
  echo "ios:test requires macOS with Xcode installed." >&2
  exit 1
fi
for tool in xcodebuild xcodegen; do
  if ! command -v "$tool" >/dev/null 2>&1; then
    echo "ios:test requires $tool in PATH." >&2
    exit 1
  fi
done

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
cd "$repo_root/apps/ios"
xcodegen generate --spec project.yml
xcodebuild test \
  -project Praci.xcodeproj \
  -scheme Praci \
  -destination "${IOS_TEST_DESTINATION:-platform=iOS Simulator,name=iPhone 17}"
