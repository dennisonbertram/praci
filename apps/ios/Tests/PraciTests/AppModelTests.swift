import Foundation
import RakazoCore
import Testing

@testable import Praci

private final class MemoryStorage: SessionStorage, @unchecked Sendable {
  // Reason: tests touch it from one task at a time.
  var session: StoredSession?
  func load() throws -> StoredSession? { session }
  func save(_ session: StoredSession) throws { self.session = session }
  func clear() throws { session = nil }
}

private actor ScriptedTransport: HTTPTransport {
  private var responses: [HTTPResponse]
  private(set) var requests: [HTTPRequest] = []
  private var hook: (@Sendable () async -> Void)?
  init(_ responses: [HTTPResponse]) { self.responses = responses }
  func beforeSend(_ hook: @escaping @Sendable () async -> Void) { self.hook = hook }
  func send(_ request: HTTPRequest, maximumResponseBytes: Int) async throws -> HTTPResponse {
    requests.append(request)
    let response = responses.isEmpty ? HTTPResponse(statusCode: 500) : responses.removeFirst()
    if requests.count > 1, let run = hook {
      hook = nil
      await run()
    }
    return response
  }
}

private let endpoint = URL(string: "http://127.0.0.1:3301")!
private let sessionOK = HTTPResponse(statusCode: 200, body: Data(#"{"user":{"id":"u1"}}"#.utf8))
private let unauthorized = HTTPResponse(statusCode: 401)
private func ok(_ json: String) -> HTTPResponse {
  HTTPResponse(statusCode: 200, body: Data(json.utf8))
}

private struct Pong: Decodable, Equatable { let ok: Bool }

@MainActor
private func makeModel(_ responses: [HTTPResponse]) async throws -> (AppModel, ScriptedTransport) {
  let transport = ScriptedTransport([sessionOK] + responses)
  let storage = MemoryStorage()
  storage.session = StoredSession(endpoint: endpoint, token: "synthetic-token")
  let client = AuthClient(endpoint: endpoint, storage: storage, transport: transport)
  let authentication = AuthenticationModel(
    client: client, defaults: UserDefaults(suiteName: UUID().uuidString)!)
  try await client.restore()
  await authentication.sync()
  let defaults = UserDefaults(suiteName: UUID().uuidString)!
  return (AppModel(authentication: authentication, transport: transport, defaults: defaults), transport)
}

@Test
@MainActor
func spaceRejectedClearsTheSpaceAndRetriesOnceWithoutIt() async throws {
  let (app, transport) = try await makeModel([unauthorized, ok(#"{"json":{"ok":true}}"#)])
  app.spaceID = "space-1"
  let pong: Pong = try await app.call("health")
  #expect(pong == Pong(ok: true))
  #expect(app.spaceID == nil)
  let requests = await transport.requests.dropFirst()
  #expect(requests.count == 2)
  #expect(requests.first?.headers["x-rakazo-space-id"] == "space-1")
  #expect(requests.last?.headers["x-rakazo-space-id"] == nil)
  #expect(app.authentication.isSignedIn)
}

@Test
@MainActor
func unauthorizedReturnsToSignInWithNotice() async throws {
  let (app, _) = try await makeModel([unauthorized])
  await #expect(throws: RPCError.unauthorized) {
    let _: Pong = try await app.call("health")
  }
  #expect(!app.authentication.isSignedIn)
  #expect(app.authentication.notice?.hasPrefix("Your session ended.") == true)
  #expect(app.spaceID == nil)
}

@Test
@MainActor
func staleUnauthorizedDoesNothing() async throws {
  let (app, transport) = try await makeModel([unauthorized, ok("{}")])
  // The session changes while the request is in flight, so its 401 belongs to an older session.
  await transport.beforeSend { try? await app.authentication.client.signOut() }
  await #expect(throws: RPCError.stale) {
    let _: Pong = try await app.call("health")
  }
  #expect(app.authentication.isSignedIn)
  #expect(app.authentication.notice == nil)
}
