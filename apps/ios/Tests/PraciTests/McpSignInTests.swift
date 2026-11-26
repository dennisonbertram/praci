import Foundation
import RakazoAPI
import RakazoCore
import Testing

@testable import Praci

private func callback(_ query: String) -> URL { URL(string: "rakazo://mcp/oauth/callback\(query)")! }

@Test func callbackWithCodeAndMatchingStateYieldsTheCode() {
  #expect(McpOAuth.parse(callback("?code=abc&state=s1"), expectedState: "s1") == .code("abc"))
  #expect(McpOAuth.parse(callback("?state=s1&code=abc&extra=1&iss=x"), expectedState: "s1") == .code("abc"))
}

@Test func callbackProviderErrorIsReportedOnlyWithTheRightState() {
  #expect(McpOAuth.parse(callback("?error=access_denied&state=s1"), expectedState: "s1") == .providerError)
  #expect(McpOAuth.parse(callback("?error=access_denied&state=other"), expectedState: "s1") == .invalid)
}

@Test func callbackWithWrongStateMissingCodeOrJunkIsInvalid() {
  #expect(McpOAuth.parse(callback("?code=abc&state=other"), expectedState: "s1") == .invalid)
  #expect(McpOAuth.parse(callback("?code=abc"), expectedState: "s1") == .invalid)
  #expect(McpOAuth.parse(callback("?state=s1"), expectedState: "s1") == .invalid)
  #expect(McpOAuth.parse(callback("?code=&state=s1"), expectedState: "s1") == .invalid)
  #expect(McpOAuth.parse(callback(""), expectedState: "s1") == .invalid)
  #expect(McpOAuth.parse(URL(string: "rakazo://sso?code=abc&state=s1")!, expectedState: "s1") == .invalid)
  #expect(McpOAuth.parse(URL(string: "https://evil.example/oauth/callback?code=abc&state=s1")!, expectedState: "s1") == .invalid)
}

private struct Down: LocalizedError { var errorDescription: String? { "No connection." } }

/// Records what the flow calls. `complete` must never run unless the callback is good.
@MainActor
private final class Recorder {
  var completed: [[String]] = []
  var opened: [URL] = []
}

@MainActor
private func flow(
  _ recorder: Recorder, begin: McpOAuthBegin? = nil,
  beginError: (any Error)? = nil, browser: Result<URL, any Error>,
  completeError: (any Error)? = nil
) -> McpSignInFlow {
  McpSignInFlow(
    begin: { _, _ in
      if let beginError { throw beginError }
      return begin
        ?? McpOAuthBegin(
          status: "authorization_required", sessionId: "s1", authorizationUrl: "https://auth.example/authorize")
    },
    open: { url in
      await MainActor.run { recorder.opened.append(url) }
      return try browser.get()
    },
    complete: { id, code, state in
      await MainActor.run { recorder.completed.append([id, code, state]) }
      if let completeError { throw completeError }
    })
}

@MainActor
@Test func signInCompletesWithTheCodeFromTheBrowser() async {
  let recorder = Recorder()
  let outcome = await flow(recorder, browser: .success(callback("?code=abc&state=s1")))
    .run(serverID: "srv", reauthorize: false)
  #expect(outcome == .connected)
  #expect(recorder.completed == [["s1", "abc", "s1"]])
  #expect(recorder.opened.map(\.host) == ["auth.example"])
}

@MainActor
@Test func cancellingTheBrowserEndsQuietlyWithoutCompleting() async {
  let recorder = Recorder()
  let outcome = await flow(recorder, browser: .failure(CancellationError())).run(serverID: "srv", reauthorize: true)
  #expect(outcome == .cancelled)
  #expect(recorder.completed.isEmpty)
}

@MainActor
@Test func aProviderErrorShowsAMessageAndNeverCompletes() async {
  let recorder = Recorder()
  let outcome = await flow(recorder, browser: .success(callback("?error=access_denied&state=s1")))
    .run(serverID: "srv", reauthorize: false)
  #expect(outcome == .failed("The provider declined the sign-in."))
  #expect(recorder.completed.isEmpty)
}

@MainActor
@Test func aWrongStateOrMissingCodeNeverCompletes() async {
  for query in ["?code=abc&state=forged", "?state=s1", "?junk"] {
    let recorder = Recorder()
    let outcome = await flow(recorder, browser: .success(callback(query))).run(serverID: "srv", reauthorize: false)
    #expect(outcome == .failed(McpSignInFlow.unfinished), "\(query)")
    #expect(recorder.completed.isEmpty, "\(query)")
  }
}

@MainActor
@Test func networkFailuresSurfaceTheirMessage() async {
  let recorder = Recorder()
  let atBegin = await flow(recorder, beginError: Down(), browser: .failure(CancellationError()))
    .run(serverID: "srv", reauthorize: false)
  #expect(atBegin == .failed("No connection."))
  #expect(recorder.opened.isEmpty)
  let atComplete = await flow(
    recorder, browser: .success(callback("?code=abc&state=s1")), completeError: Down()
  ).run(serverID: "srv", reauthorize: false)
  #expect(atComplete == .failed("No connection."))
}

@MainActor
@Test func alreadyConnectedAndNotRequestedDoNotOpenTheBrowser() async {
  let recorder = Recorder()
  let connected = await flow(
    recorder, begin: McpOAuthBegin(status: "already_connected"), browser: .failure(Down())
  ).run(serverID: "srv", reauthorize: false)
  #expect(connected == .connected)
  let none = await flow(
    recorder, begin: McpOAuthBegin(status: "authorization_not_requested"), browser: .failure(Down())
  ).run(serverID: "srv", reauthorize: false)
  #expect(none == .failed("This server did not ask for a sign-in."))
  #expect(recorder.opened.isEmpty && recorder.completed.isEmpty)
}

@MainActor
@Test func aNonWebAuthorizationUrlIsRefused() async {
  let recorder = Recorder()
  let outcome = await flow(
    recorder,
    begin: McpOAuthBegin(status: "authorization_required", sessionId: "s1", authorizationUrl: "file:///etc/passwd"),
    browser: .failure(Down())
  ).run(serverID: "srv", reauthorize: false)
  #expect(outcome == .failed(McpSignInFlow.unfinished))
  #expect(recorder.opened.isEmpty)
}

@Test func serverStatusFollowsTheWeb() {
  #expect(McpServer(id: "a", name: "A", oauthStatus: "connected").rowStatus == .ok)
  #expect(McpServer(id: "a", name: "A", oauthStatus: "none").rowStatus == .ok)
  #expect(McpServer(id: "a", name: "A", oauthStatus: "reconnect").rowStatus == .needsReconnect)
  #expect(McpServer(id: "a", name: "A", oauthStatus: "none", oauthAttempted: true).rowStatus == .needsReconnect)
  #expect(McpServer(id: "a", name: "A", enabled: false, oauthStatus: "reconnect").rowStatus == .off)
  #expect(McpServer(id: "a", name: "A", oauthStatus: "none").isFirstSignIn)
  #expect(!McpServer(id: "a", name: "A", oauthStatus: "connected").isFirstSignIn)
  #expect(!McpServer(id: "a", name: "A", transport: "stdio").canSignIn)
  #expect(!McpServer(id: "a", name: "A", enabled: false).canSignIn)
  #expect(!McpServer(id: "a", name: "A", oauthSupported: false).canSignIn)
  #expect(McpServer(id: "a", name: "A").canSignIn)
}

@Test func connectionStatusShowsErrorAndPending() throws {
  func status(_ json: String) throws -> RowStatus {
    try JSONDecoder().decode(Connection.self, from: Data(json.utf8)).rowStatus
  }
  #expect(try status(#"{"id":"c","status":"connected"}"#) == .ok)
  #expect(try status(#"{"id":"c","status":"connected","needsReconnect":true}"#) == .needsReconnect)
  #expect(try status(#"{"id":"c","status":"error","error":"x"}"#) == .failed)
  #expect(try status(#"{"id":"c","status":"pending"}"#) == .connecting)
}

private actor Routes: HTTPTransport {
  private let answers: [String: String]
  init(_ answers: [String: String]) { self.answers = answers }
  func send(_ request: HTTPRequest, maximumResponseBytes: Int) async throws -> HTTPResponse {
    let name = request.url.path.replacingOccurrences(of: "/rpc/", with: "")
    if request.url.path.contains("session") {
      return HTTPResponse(statusCode: 200, body: Data(#"{"user":{"id":"u1"}}"#.utf8))
    }
    guard let body = answers[name] else { return HTTPResponse(statusCode: 500) }
    return HTTPResponse(statusCode: 200, body: Data(body.utf8))
  }
}

private final class Memory: SessionStorage, @unchecked Sendable {
  // Reason: tests touch it from one task at a time.
  var session: StoredSession?
  func load() throws -> StoredSession? { session }
  func save(_ session: StoredSession) throws { self.session = session }
  func clear() throws { session = nil }
}

@MainActor
private func makeApp(_ answers: [String: String]) async throws -> AppModel {
  let routes = Routes(answers)
  let endpoint = URL(string: "http://127.0.0.1:3301")!
  let storage = Memory()
  storage.session = StoredSession(endpoint: endpoint, token: "synthetic-token")
  let client = AuthClient(endpoint: endpoint, storage: storage, transport: routes)
  let authentication = AuthenticationModel(client: client, defaults: UserDefaults(suiteName: UUID().uuidString)!)
  try await client.restore()
  await authentication.sync()
  return AppModel(
    authentication: authentication, transport: routes, defaults: UserDefaults(suiteName: UUID().uuidString)!)
}

@MainActor
@Test func aFailedServerListFailsTheScreenSoItCanRetry() async throws {
  let app = try await makeApp(["connections/list": #"{"json":[]}"#, "connections/featured": #"{"json":[]}"#])
  let model = IntegrationsModel()
  await model.load(app)
  guard case .failed = model.state else {
    Issue.record("expected the load to fail, got \(model.state)")
    return
  }
}

@MainActor
@Test func disabledServersStayInTheList() async throws {
  let servers =
    #"{"json":[{"id":"s1","name":"On","enabled":true},{"id":"s2","name":"Off one","enabled":false}]}"#
  let app = try await makeApp([
    "connections/list": #"{"json":[]}"#, "connections/featured": #"{"json":[]}"#, "mcp/servers/list": servers,
  ])
  let model = IntegrationsModel()
  await model.load(app)
  #expect(model.state.value?.servers.map(\.id) == ["s1", "s2"])
}

private func connectionJSON(_ id: String, _ status: String) -> String {
  #"{"id":"\#(id)","connectorId":"composio","provider":"googlecalendar","displayName":"Cal","status":"\#(status)","needsReconnect":false,"writesEnabled":false}"#
}

@MainActor
@Test func aPendingRowFromEarlierIsCompletedWhenTheScreenLoads() async throws {
  let app = try await makeApp([
    "connections/list": #"{"json":[\#(connectionJSON("c1", "pending"))]}"#,
    "connections/complete": #"{"json":\#(connectionJSON("c1", "connected"))}"#,
    "connections/featured": #"{"json":[]}"#, "mcp/servers/list": #"{"json":[]}"#,
  ])
  let model = IntegrationsModel()
  await model.load(app)
  #expect(model.state.value?.connections.map(\.status) == ["connected"])
}

@MainActor
@Test func aPendingRowThatStaysPendingIsKeptSoItCanBeRetried() async throws {
  let app = try await makeApp([
    "connections/list": #"{"json":[\#(connectionJSON("c1", "pending"))]}"#,
    "connections/complete": #"{"json":\#(connectionJSON("c1", "pending"))}"#,
    "connections/featured": #"{"json":[]}"#, "mcp/servers/list": #"{"json":[]}"#,
  ])
  let model = IntegrationsModel()
  await model.load(app)
  #expect(model.state.value?.connections.first?.rowStatus == .connecting)
}

@Test func providerSlugsReadAsNames() {
  #expect("googlecalendar".providerName == "Google Calendar")
  #expect("slack".providerName == "Slack")
}
