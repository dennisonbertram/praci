# Native iOS development

The SwiftUI app and its Swift packages live in `apps/ios`. The generated Xcode
project is intentionally not committed.

Requirements: macOS, Xcode with the iOS 26 SDK and Simulator runtime, XcodeGen,
SwiftLint, and SwiftFormat.

```sh
pnpm ios:tokens
pnpm ios:tokens:check
pnpm contracts:generate
pnpm contracts:check
pnpm contracts:record-fixtures
pnpm ios:test
swift test --package-path apps/ios/Packages/RakazoAPI
swiftlint lint --strict
swiftformat --lint apps/ios
```

Set `IOS_TEST_DESTINATION` to an `xcodebuild -destination` value to select a
simulator, for example
`platform=iOS Simulator,name=iPhone 17,OS=latest`. The `Praci` scheme runs the
app test target and every SwiftPM package test target.

The semantic colors and bot palette are generated from
`packages/ui-tokens/src/index.ts`. Edit the TypeScript source, then regenerate
`RakazoUI/Sources/RakazoUI/Tokens.swift` with `pnpm ios:tokens`.

The OpenAPI document is generated from `packages/contracts/src/rpc.ts` into
`RakazoAPI/Sources/RakazoAPI/openapi.json`, which the SwiftPM build plugin reads
directly. The health response fixture is recorded over localhost using the
real oRPC handler and `appContract.health`; the other named synthetic fixtures
are decoder tests only.
