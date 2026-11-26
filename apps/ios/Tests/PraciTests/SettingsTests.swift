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

private actor Scripted: HTTPTransport {
  private var responses: [HTTPResponse]
  private(set) var requests: [HTTPRequest] = []
  init(_ responses: [HTTPResponse]) { self.responses = responses }
  /// Replies in order, except the two archived lists, which load at the same time and so
  /// are answered by path.
  var byPath: [String: HTTPResponse] = [:]
  func route(_ path: String, _ response: HTTPResponse) { byPath[path] = response }
  func send(_ request: HTTPRequest, maximumResponseBytes: Int) async throws -> HTTPResponse {
    requests.append(request)
    if let routed = byPath[request.url.path] { return routed }
    return responses.isEmpty ? HTTPResponse(statusCode: 500) : responses.removeFirst()
  }
}

private let endpoint = URL(string: "http://127.0.0.1:3301")!
private func ok(_ json: String) -> HTTPResponse { HTTPResponse(statusCode: 200, body: Data(json.utf8)) }

@MainActor
private func makeApp(_ responses: [HTTPResponse]) async throws -> (AppModel, Scripted) {
  let transport = Scripted([ok(#"{"user":{"id":"u1"}}"#)] + responses)
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

private let archivedBot =
  #"{"id":"b1","name":"Old bot","archivedAt":"2026-10-03T03:26:53.690Z","updatedAt":"2026-10-03T03:26:53.690Z"}"#
private let archivedGroup =
  #"{"id":"g1","name":"Old group","archivedAt":"2026-10-05T03:26:53.690Z","members":[],"#
    + #""updatedAt":"2026-10-05T03:26:53.690Z","preview":"","unread":false,"pinned":false}"#

@Test
@MainActor
func archivedListMergesBotsAndGroupsNewestFirstAndRestoreRemovesTheRow() async throws {
  let (app, transport) = try await makeApp([ok(#"{"json":{"ok":true}}"#)])
  await transport.route("/rpc/bots/listArchived", ok("{\"json\":[\(archivedBot)]}"))
  await transport.route("/rpc/groups/listArchived", ok("{\"json\":[\(archivedGroup)]}"))
  let model = ArchivedModel()
  await model.load(app)
  let entries = try #require(model.state.value)
  #expect(entries.map(\.id) == ["g1", "b1"])
  await model.restore(entries[1], app)
  #expect(model.state.value?.map(\.id) == ["g1"])
  let last = try #require(await transport.requests.last)
  #expect(last.url.path == "/rpc/bots/restore")
}

@Test
@MainActor
func failedRestoreKeepsTheRowAndShowsTheError() async throws {
  let (app, transport) = try await makeApp([
    HTTPResponse(
      statusCode: 400,
      body: Data(#"{"json":{"defined":false,"code":"BAD_REQUEST","status":400,"message":"Nope"}}"#.utf8))
  ])
  await transport.route("/rpc/bots/listArchived", ok("{\"json\":[\(archivedBot)]}"))
  await transport.route("/rpc/groups/listArchived", ok(#"{"json":[]}"#))
  let model = ArchivedModel()
  await model.load(app)
  await model.restore(try #require(model.state.value?.first), app)
  #expect(model.state.value?.count == 1)
  #expect(model.errorMessage == "Nope")
}

private let meJSON =
  #"{"json":{"userId":"u1","email":"a@example.test","name":"Alex Morgan","spaceId":"s1","hideAmounts":false}}"#

@Test
@MainActor
func hideAmountsRevertsWhenTheServerRefuses() async throws {
  let (app, _) = try await makeApp([ok(meJSON), HTTPResponse(statusCode: 500)])
  let model = SettingsModel()
  await model.load(app)
  await model.setHideAmounts(true, app)
  #expect(app.hideAmounts == false)
  #expect(model.errorMessage != nil)
}

@Test
@MainActor
func hideAmountsAdoptsTheServerAnswer() async throws {
  let (app, _) = try await makeApp([
    ok(meJSON), ok(meJSON.replacingOccurrences(of: "false", with: "true")),
  ])
  let model = SettingsModel()
  await model.load(app)
  await model.setHideAmounts(true, app)
  #expect(app.hideAmounts)
}

@Test
func changePasswordFormNeedsEightCharactersAndAMatch() {
  var form = ChangePasswordForm(current: "old", new: "short", confirmation: "short")
  #expect(!form.canSave)
  form.new = "long-enough"
  form.confirmation = "different"
  #expect(form.error == .mismatch)
  form.confirmation = "long-enough"
  #expect(form.canSave && form.error == nil)
}

private func usage(_ json: String) throws -> UsageSummary {
  try JSONDecoder().decode(UsageSummary.self, from: Data(json.utf8))
}

@Test
func usageTotalFallsBackToInputPlusOutput() throws {
  #expect(try usage(#"{"inputTokens":12,"outputTokens":40,"totalTokens":null,"runs":1}"#).displayTotal == 52)
  #expect(try usage(#"{"inputTokens":12,"outputTokens":40,"totalTokens":99,"runs":1}"#).displayTotal == 99)
  #expect(
    try usage(#"{"inputTokens":12,"outputTokens":40,"cacheReadTokens":100,"cacheWriteTokens":8,"totalTokens":null,"runs":1}"#)
      .displayTotal == 160)
  #expect(try usage(#"{"inputTokens":null,"outputTokens":null,"totalTokens":null,"runs":1}"#).displayTotal == nil)
}

@Test
@MainActor
func settingsOpensAtItsDestinationAndCountsClosings() async throws {
  let (app, _) = try await makeApp([])
  app.openSettings(.models)
  #expect(app.showingSettings && app.settingsDestination == .models)
  app.openSettings()
  #expect(app.settingsDestination == nil)
  let before = app.settingsClosings
  app.settingsDidClose()
  #expect(app.settingsClosings == before + 1)
  app.openSettings(.models)
  app.settingsDidClose()
  #expect(app.settingsDestination == nil)
}

@Test
func serverNameShowsHostAndPort() {
  #expect(URL(string: "https://app.example.com/x")!.serverName == "app.example.com")
  #expect(URL(string: "http://127.0.0.1:3100")!.serverName == "127.0.0.1:3100")
}

@Test
func onlyTheStopTheBotConflictBlocksTakeover() {
  #expect(ComputerModel.isBotBlockingTakeover(RPCError.server(code: "CONFLICT", status: 409, message: "Stop the bot first")))
  #expect(!ComputerModel.isBotBlockingTakeover(RPCError.server(code: "CONFLICT", status: 409, message: "Control changed")))
  #expect(!ComputerModel.isBotBlockingTakeover(RPCError.server(code: "BAD_REQUEST", status: 400, message: "Stop the bot first")))
}
