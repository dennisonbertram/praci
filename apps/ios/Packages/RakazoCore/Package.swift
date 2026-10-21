// swift-tools-version: 6.0

import PackageDescription

let package = Package(
    name: "RakazoCore",
    products: [
        .library(name: "RakazoCore", targets: ["RakazoCore"]),
    ],
    targets: [
        .target(name: "RakazoCore"),
        .testTarget(name: "RakazoCoreTests", dependencies: ["RakazoCore"]),
    ]
)
