// swift-tools-version: 6.0

import PackageDescription

let package = Package(
  name: "RakazoCore",
  platforms: [.iOS("26.0")],
  products: [
    .library(name: "RakazoCore", targets: ["RakazoCore"])
  ],
  targets: [
    .target(name: "RakazoCore"),
    .testTarget(name: "RakazoCoreTests", dependencies: ["RakazoCore"]),
  ]
)
