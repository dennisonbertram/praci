// swift-tools-version: 6.2

import PackageDescription

let package = Package(
    name: "RakazoUI",
    platforms: [.iOS(.v26)],
    products: [
        .library(name: "RakazoUI", targets: ["RakazoUI"]),
    ],
    targets: [
        .target(name: "RakazoUI"),
        .testTarget(name: "RakazoUITests", dependencies: ["RakazoUI"]),
    ]
)
