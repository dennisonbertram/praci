// swift-tools-version: 6.0

import PackageDescription

let package = Package(
  name: "RakazoAPI",
  platforms: [.iOS("26.0")],
  products: [
    .library(name: "RakazoAPI", targets: ["RakazoAPI"])
  ],
  dependencies: [
    .package(
      url: "https://github.com/apple/swift-openapi-generator.git",
      exact: "1.11.0"
    ),
    .package(
      url: "https://github.com/apple/swift-openapi-runtime.git",
      exact: "1.11.0"
    ),
  ],
  targets: [
    .target(
      name: "RakazoAPI",
      dependencies: [
        .product(name: "OpenAPIRuntime", package: "swift-openapi-runtime")
      ],
      plugins: [
        .plugin(name: "OpenAPIGenerator", package: "swift-openapi-generator")
      ]
    ),
    .testTarget(
      name: "RakazoAPITests",
      dependencies: ["RakazoAPI"],
      resources: [.process("Fixtures")]
    ),
  ]
)
