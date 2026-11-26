import Foundation
import RakazoCore
import SwiftUI
import Testing
import UIKit

@testable import Praci

private final class MemoryStorage: SessionStorage, @unchecked Sendable {
  // Reason: tests touch it from one task at a time.
  var session: StoredSession?
  func load() throws -> StoredSession? { session }
  func save(_ session: StoredSession) throws { self.session = session }
  func clear() throws { session = nil }
}

/// Answers each procedure from the API package's recorded fixtures; unknown ones fail like an
/// unreachable server.
private struct FixtureTransport: HTTPTransport {
  static let fixtures = URL(fileURLWithPath: #filePath)
    .deletingLastPathComponent().deletingLastPathComponent().deletingLastPathComponent()
    .appendingPathComponent("Packages/RakazoAPI/Tests/RakazoAPITests/Fixtures")
  static let files = [
    "bootstrap": "home-bootstrap", "inbox/unreadCount": "home-unread-count",
    "inbox/list": "inbox-list", "meetings/list": "meetings-list",
    "threads/get": "thread-get-bot", "threads/messages": "thread-messages",
    "me": "rpc-me", "connections/list": "connections-list",
    "approvalRules/list": "approval-rules-list", "autoReview/get": "auto-review-get", "permissions/get": "permissions-get",
    "bots/listArchived": "settings-archived-bots", "groups/listArchived": "settings-archived-groups",
  ]

  func send(_ request: HTTPRequest, maximumResponseBytes: Int) async throws -> HTTPResponse {
    let name = request.url.path.replacingOccurrences(of: "/rpc/", with: "")
    if let file = Self.files[name],
      let data = try? Data(contentsOf: Self.fixtures.appendingPathComponent(file + ".json"))
    {
      return HTTPResponse(statusCode: 200, body: data)
    }
    if request.url.path.contains("session") {
      return HTTPResponse(statusCode: 200, body: Data(#"{"user":{"id":"u1"}}"#.utf8))
    }
    return HTTPResponse(statusCode: 500)
  }
}

@MainActor
private func makeApp() async throws -> AppModel {
  let transport = FixtureTransport()
  let endpoint = URL(string: "http://127.0.0.1:3301")!
  let storage = MemoryStorage()
  storage.session = StoredSession(endpoint: endpoint, token: "synthetic-token")
  let client = AuthClient(endpoint: endpoint, storage: storage, transport: transport)
  let authentication = AuthenticationModel(
    client: client, defaults: UserDefaults(suiteName: UUID().uuidString)!)
  try await client.restore()
  await authentication.sync()
  let app = AppModel(
    authentication: authentication, transport: transport,
    defaults: UserDefaults(suiteName: UUID().uuidString)!)
  app.spaceID = "space-placeholder"
  return app
}

/// Draws a view in a window of the given size and saves it as a PNG when `DUO_SHOTS` names a folder.
@MainActor
private func shot<V: View>(_ view: V, size: CGSize, name: String) async {
  let scene = UIApplication.shared.connectedScenes.compactMap { $0 as? UIWindowScene }.first
  let window = scene.map { UIWindow(windowScene: $0) } ?? UIWindow()
  window.frame = CGRect(origin: .zero, size: size)
  defer { window.isHidden = true }  // a window left visible covers the screen for later tests
  window.rootViewController = UIHostingController(rootView: view)
  window.isHidden = false
  window.layoutIfNeeded()
  try? await Task.sleep(for: .seconds(1.5))
  window.layoutIfNeeded()
  guard let folder = ProcessInfo.processInfo.environment["DUO_SHOTS"] else { return }
  let image = UIGraphicsImageRenderer(size: size).image { _ in
    window.drawHierarchy(in: CGRect(origin: .zero, size: size), afterScreenUpdates: true)
  }
  try? FileManager.default.createDirectory(atPath: folder, withIntermediateDirectories: true)
  try? image.pngData()?.write(to: URL(fileURLWithPath: folder).appendingPathComponent(name + ".png"))
}

private let sizes: [(String, CGSize)] = [
  ("iphone-402x874", CGSize(width: 402, height: 874)),
  ("outer-466x678", CGSize(width: 466, height: 678)),
  ("inner-landscape-890x626", CGSize(width: 890, height: 626)),
  ("inner-portrait-626x890", CGSize(width: 626, height: 890)),
]

@Test func twoPaneOnlyOnTheWideInnerDisplay() {
  #expect(!DuoLayout.isTwoPane(width: 466))
  #expect(!DuoLayout.isTwoPane(width: 626))
  #expect(DuoLayout.isTwoPane(width: 890))
  #expect(DuoLayout.sidebarWidth(width: 890) == 445)  // the fold
}

@Test @MainActor func rendersTheMainScreensAtEveryDuoSize() async throws {
  for (label, size) in sizes {
    let screens: [(String, [Route])] = [
      ("home", []), ("thread", [.thread(.bot("bot-1"))]), ("inbox", [.inbox]),
      ("meetings", [.meetings]),
    ]
    for (name, path) in screens {
      let app = try await makeApp()
      app.path = path
      await shot(AppShell().environment(app), size: size, name: "\(name)-\(label)")
    }
    let app = try await makeApp()
    await shot(
      NavigationStack { SettingsScreen() }.environment(app), size: size, name: "settings-\(label)")
  }
}
