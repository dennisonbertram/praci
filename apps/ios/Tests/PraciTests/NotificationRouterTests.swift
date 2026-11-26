import Foundation
import RakazoCore
import Testing

@testable import Praci

private final class Storage: SessionStorage, @unchecked Sendable {
  // Reason: tests touch it from one task at a time.
  var session: StoredSession?
  func load() throws -> StoredSession? { session }
  func save(_ session: StoredSession) throws { self.session = session }
  func clear() throws { session = nil }
}

private actor Recorder: HTTPTransport {
  private(set) var urls: [String] = []
  func send(_ request: HTTPRequest, maximumResponseBytes: Int) async throws -> HTTPResponse {
    urls.append(request.url.path)
    let body = urls.count == 1 ? #"{"user":{"id":"u1"}}"# : #"{"json":{"ok":true}}"#
    return HTTPResponse(statusCode: 200, body: Data(body.utf8))
  }
}

@MainActor
// swiftlint:disable:next large_tuple
private func make(token: Bool) async throws -> (AppModel, NotificationRouter, Recorder) {
  let transport = Recorder()
  let endpoint = URL(string: "http://127.0.0.1:3301")!
  let storage = Storage()
  storage.session = StoredSession(endpoint: endpoint, token: "synthetic-token")
  let client = AuthClient(endpoint: endpoint, storage: storage, transport: transport)
  let authentication = AuthenticationModel(
    client: client, defaults: UserDefaults(suiteName: UUID().uuidString)!)
  try await client.restore()
  await authentication.sync()
  let defaults = UserDefaults(suiteName: UUID().uuidString)!
  let app = AppModel(authentication: authentication, transport: transport, defaults: defaults)
  let router = NotificationRouter(app: app, defaults: defaults)
  if token { router.didRegister(token: "synthetic-device-token") }
  return (app, router, transport)
}

@Test
@MainActor
func signOutUnregistersPushFirstWhenATokenExists() async throws {
  let (app, router, transport) = try await make(token: true)
  await app.authentication.signOut()
  withExtendedLifetime(router) {}
  let urls = await transport.urls
  let unregister = try #require(urls.firstIndex { $0.hasSuffix("notifications/unregisterPush") })
  let signOut = try #require(urls.firstIndex { $0.contains("sign-out") })
  #expect(unregister < signOut)
  #expect(!app.authentication.isSignedIn)
}

@Test
@MainActor
func signOutSkipsUnregisterWithoutAToken() async throws {
  let (app, router, transport) = try await make(token: false)
  await app.authentication.signOut()
  withExtendedLifetime(router) {}
  let urls = await transport.urls
  #expect(!urls.contains { $0.contains("unregisterPush") })
  #expect(!app.authentication.isSignedIn)
}

@MainActor
private func signedOutRouter() async throws -> NotificationRouter {
  let endpoint = URL(string: "http://127.0.0.1:3301")!
  let client = AuthClient(endpoint: endpoint, storage: Storage(), transport: Recorder())
  let authentication = AuthenticationModel(
    client: client, defaults: UserDefaults(suiteName: UUID().uuidString)!)
  await authentication.sync()
  let defaults = UserDefaults(suiteName: UUID().uuidString)!
  let app = AppModel(authentication: authentication, defaults: defaults)
  return NotificationRouter(app: app, defaults: defaults)
}

@Test
@MainActor
func launchTapWaitsForSessionRestoreThenIsDroppedIfSignedOut() async throws {
  let router = try await signedOutRouter()
  let target = try #require(PushTarget(userInfo: ["botId": "b1", "spaceId": "s1"]))
  router.open(target)
  #expect(router.pending == target)
  router.settle(startupDone: true)
  #expect(router.pending == nil)
}

@Test
@MainActor
func tapWhileSignedOutAfterStartupIsDiscarded() async throws {
  let router = try await signedOutRouter()
  router.settle(startupDone: true)
  let target = try #require(PushTarget(userInfo: ["botId": "b1"]))
  router.open(target)
  #expect(router.pending == nil)
}
