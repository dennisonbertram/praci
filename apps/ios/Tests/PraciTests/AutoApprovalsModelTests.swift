import Foundation
import RakazoAPI
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

/// Answers by path; a path with several queued responses returns them in order and then repeats
/// the last one, so a screen can fail once and recover on Retry.
private actor Scripted: HTTPTransport {
  private var queues: [String: [HTTPResponse]] = [:]
  private var fallback: [HTTPResponse]
  private(set) var requests: [HTTPRequest] = []

  init(_ responses: [HTTPResponse] = []) { fallback = responses }

  func route(_ path: String, _ responses: HTTPResponse...) { queues[path] = responses }

  func send(_ request: HTTPRequest, maximumResponseBytes: Int) async throws -> HTTPResponse {
    requests.append(request)
    if var queue = queues[request.url.path], !queue.isEmpty {
      let response = queue.count > 1 ? queue.removeFirst() : queue[0]
      queues[request.url.path] = queue
      return response
    }
    return fallback.isEmpty ? HTTPResponse(statusCode: 500) : fallback.removeFirst()
  }

  func calls(to path: String) -> Int { requests.filter { $0.url.path == path }.count }
}

private let endpoint = URL(string: "http://127.0.0.1:3301")!
private func ok(_ json: String) -> HTTPResponse { HTTPResponse(statusCode: 200, body: Data(json.utf8)) }

private let rowA =
  #"{"id":"a1","tool":"mail_send","botName":"Pia","target":"SAFE update","#
  + #""at":"2026-10-03T03:26:53.690Z","undoable":true,"undone":false}"#
private let rowB =
  #"{"id":"a2","tool":"brex_cards_view","botName":"Pia","target":null,"#
  + #""at":"2026-10-02T03:26:53.690Z","undoable":true,"undone":false}"#

@MainActor
private func makeApp() async throws -> (AppModel, Scripted) {
  let transport = Scripted([ok(#"{"user":{"id":"u1"}}"#)])
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
  return (app, transport)
}

@Test
@MainActor
func loadShowsTheRows() async throws {
  let (app, transport) = try await makeApp()
  await transport.route("/rpc/autoReview/approvals", ok("{\"json\":{\"rows\":[\(rowA),\(rowB)]}}"))
  let model = AutoApprovalsModel()
  await model.load(app)
  #expect(!model.hidden)
  #expect(!model.loadFailed)
  #expect(model.rows.map(\.id) == ["a1", "a2"])
}

@Test
@MainActor
func emptyLoadStaysHidden() async throws {
  let (app, transport) = try await makeApp()
  await transport.route("/rpc/autoReview/approvals", ok(#"{"json":{"rows":[]}}"#))
  let model = AutoApprovalsModel()
  await model.load(app)
  #expect(model.hidden)
}

@Test
@MainActor
func failedLoadShowsRetryAndRecovers() async throws {
  let (app, transport) = try await makeApp()
  await transport.route(
    "/rpc/autoReview/approvals",
    HTTPResponse(statusCode: 500),
    ok("{\"json\":{\"rows\":[\(rowA)]}}"))
  let model = AutoApprovalsModel()
  await model.load(app)
  #expect(model.loadFailed)
  #expect(!model.hidden)
  await model.load(app)
  #expect(!model.loadFailed)
  #expect(model.rows.map(\.id) == ["a1"])
}

@Test
@MainActor
func undoMarksTheRowUndone() async throws {
  let (app, transport) = try await makeApp()
  await transport.route("/rpc/autoReview/approvals", ok("{\"json\":{\"rows\":[\(rowA),\(rowB)]}}"))
  await transport.route("/rpc/autoReview/undo", ok(#"{"json":{"ok":true}}"#))
  let model = AutoApprovalsModel()
  await model.load(app)
  await model.undo(app, id: "a1")
  let undone = try #require(model.rows.first { $0.id == "a1" })
  #expect(undone.undone)
  #expect(!undone.undoable)
  #expect(model.rows.first { $0.id == "a2" }?.undone == false)
  #expect(model.failedID == nil)
  let last = try #require(await transport.requests.last)
  #expect(last.url.path == "/rpc/autoReview/undo")
}

@Test
@MainActor
func failedUndoFlagsTheRowAndReloads() async throws {
  let (app, transport) = try await makeApp()
  await transport.route("/rpc/autoReview/approvals", ok("{\"json\":{\"rows\":[\(rowA)]}}"))
  await transport.route(
    "/rpc/autoReview/undo",
    HTTPResponse(
      statusCode: 400,
      body: Data(#"{"json":{"defined":false,"code":"BAD_REQUEST","status":400,"message":"Nope"}}"#.utf8)))
  let model = AutoApprovalsModel()
  await model.load(app)
  await model.undo(app, id: "a1")
  #expect(model.failedID == "a1")
  #expect(await transport.calls(to: "/rpc/autoReview/approvals") == 2)
  #expect(model.rows.first?.undone == false)
}
