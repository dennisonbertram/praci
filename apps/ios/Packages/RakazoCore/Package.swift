// swift-tools-version: 6.0

import PackageDescription

let package = Package(
  name: "RakazoCore",
  platforms: [.iOS("26.0"), .macOS("15.0")],
  products: [
    .library(name: "RakazoCore", targets: ["RakazoCore"])
  ],
  dependencies: [
    .package(path: "../RakazoAPI")
  ],
  targets: [
    .target(name: "RakazoCore", dependencies: ["RakazoAPI"]),
    .testTarget(name: "RakazoCoreTests", dependencies: ["RakazoCore"]),
  ]
)
