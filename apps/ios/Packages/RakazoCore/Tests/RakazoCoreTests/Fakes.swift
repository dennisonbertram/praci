import Foundation
import RakazoCore

final class FakeStorage: SessionStorage, @unchecked Sendable {
  var session: StoredSession?
  var cleared = false
  var failWrites = false

  init(session: StoredSession? = nil) { self.session = session }

  func load() throws -> StoredSession? { session }
  func save(_ session: StoredSession) throws {
    if failWrites { throw AuthClientError.storageFailure }
    self.session = session
  }
  func clear() throws {
    if failWrites { throw AuthClientError.storageFailure }
    cleared = true
    session = nil
  }
}

actor FakeTransport: HTTPTransport {
  private var responses: [HTTPResponse]
  private(set) var requests: [HTTPRequest] = []
  private(set) var limits: [Int] = []

  init(_ responses: [HTTPResponse]) { self.responses = responses }

  func send(_ request: HTTPRequest, maximumResponseBytes: Int) async throws -> HTTPResponse {
    requests.append(request)
    limits.append(maximumResponseBytes)
    return responses.isEmpty ? HTTPResponse(statusCode: 500) : responses.removeFirst()
  }
}

func rpcResponse(_ json: String, status: Int = 200) -> HTTPResponse {
  HTTPResponse(statusCode: status, body: Data(json.utf8))
}

let testEndpoint = URL(string: "http://127.0.0.1:3301")!

/// A restored, signed-in client. The first transport response answers `get-session`.
func signedInClient(
  _ transport: FakeTransport, storage: FakeStorage = FakeStorage()
) async throws -> AuthClient {
  storage.session = StoredSession(endpoint: testEndpoint, token: "tok-1")
  let client = AuthClient(endpoint: testEndpoint, storage: storage, transport: transport)
  try await client.restore()
  return client
}
