// swift-tools-version: 6.0

import PackageDescription

let package = Package(
    name: "RakazoAPI",
    products: [
        .library(name: "RakazoAPI", targets: ["RakazoAPI"]),
    ],
    targets: [
        .target(name: "RakazoAPI"),
        .testTarget(name: "RakazoAPITests", dependencies: ["RakazoAPI"]),
    ]
)
