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
# IOS_TEST_DESTINATION wins, then SIM_UDID, then the default simulator name.
destination="${IOS_TEST_DESTINATION:-${SIM_UDID:+platform=iOS Simulator,id=$SIM_UDID}}"
destination="${destination:-platform=iOS Simulator,name=iPhone 17}"
xcodebuild test \
  -project Praci.xcodeproj \
  -scheme Praci \
  -destination "$destination" \
  -derivedDataPath DerivedData \
  -clonedSourcePackagesDirPath ~/Library/Caches/praci-spm \
  -skipPackagePluginValidation -skipMacroValidation
