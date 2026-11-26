import Foundation
import RakazoAPI
import RakazoCore
import Testing

@testable import Praci

private final class MemoryStorage: SessionStorage, @unchecked Sendable {
  var session: StoredSession?
  func load() throws -> StoredSession? { session }
  func save(_ session: StoredSession) throws { self.session = session }
  func clear() throws { session = nil }
}

private actor ContactsRaceTransport: HTTPTransport {
  private let currentResponse: HTTPResponse
  private let staleResponse: HTTPResponse
  private var listRequests = 0
  private var firstListResponse: CheckedContinuation<HTTPResponse, Never>?
  private var firstListStarted: CheckedContinuation<Void, Never>?

  init() {
    currentResponse = Self.response([
      #"{"id":"current-advisor","name":"Ada Lovelace","email":"ada@example.test","organization":"Analytical Engines (Mock)","kind":"advisor","notes":"Invented advisor contact.","addedBy":null,"createdAt":"2026-11-10T12:00:00Z","updatedAt":"2026-11-11T12:00:00Z"}"#,
      #"{"id":"current-investor","name":"Grace Hopper","email":null,"organization":"Compilers (Mock)","kind":"investor","notes":null,"addedBy":null,"createdAt":"2026-11-10T12:00:00Z","updatedAt":"2026-11-11T12:00:00Z"}"#,
    ])
    staleResponse = Self.response([
      #"{"id":"stale-contact","name":"Old Contact","email":null,"organization":null,"kind":"other","notes":null,"addedBy":null,"createdAt":"2026-11-10T12:00:00Z","updatedAt":"2026-11-11T12:00:00Z"}"#
    ])
  }

  func send(_ request: HTTPRequest, maximumResponseBytes: Int) async throws -> HTTPResponse {
    guard request.url.path.hasSuffix("/rpc/contacts/list") else {
      return HTTPResponse(statusCode: 200, body: Data(#"{"user":{"id":"user-placeholder"}}"#.utf8))
    }
    listRequests += 1
    guard listRequests == 1 else { return currentResponse }
    return await withCheckedContinuation { continuation in
      firstListResponse = continuation
      firstListStarted?.resume()
      firstListStarted = nil
    }
  }

  func waitForFirstList() async {
    if firstListResponse != nil { return }
    await withCheckedContinuation { firstListStarted = $0 }
  }

  func releaseFirstList() {
    firstListResponse?.resume(returning: staleResponse)
    firstListResponse = nil
  }

  private static func response(_ contacts: [String]) -> HTTPResponse {
    HTTPResponse(
      statusCode: 200,
      body: Data(#"{"json":[\#(contacts.joined(separator: ","))]}"#.utf8))
  }
}

@MainActor
private func makeContactsApp(_ transport: ContactsRaceTransport) async throws -> AppModel {
  let endpoint = URL(string: "http://127.0.0.1:3301")!
  let storage = MemoryStorage()
  storage.session = StoredSession(endpoint: endpoint, token: "synthetic-token")
  let client = AuthClient(endpoint: endpoint, storage: storage, transport: transport)
  let authentication = AuthenticationModel(
    client: client, defaults: UserDefaults(suiteName: UUID().uuidString)!)
  try await client.restore()
  await authentication.sync()
  return AppModel(
    authentication: authentication, transport: transport,
    defaults: UserDefaults(suiteName: UUID().uuidString)!)
}

@Test
@MainActor
func searchFiltersContactsLocallyAndOlderListResponseIsIgnored() async throws {
  let transport = ContactsRaceTransport()
  let app = try await makeContactsApp(transport)
  let model = ContactsModel()

  let olderLoad = Task { await model.load(app) }
  await transport.waitForFirstList()
  await model.load(app)

  model.query = "advisor"
  #expect(model.visibleContacts.map(\.id) == ["current-advisor"])

  await transport.releaseFirstList()
  await olderLoad.value
  #expect(model.state.value?.map(\.id) == ["current-advisor", "current-investor"])
  #expect(model.visibleContacts.map(\.id) == ["current-advisor"])
}
