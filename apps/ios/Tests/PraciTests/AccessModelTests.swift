import Foundation
import RakazoAPI
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

/// Holds a call open until the test lets it finish; calls after `open` go straight through.
private actor Gate {
  private var waiters: [CheckedContinuation<Void, Never>] = []
  private var opened = false
  private(set) var started = false
  func wait() async {
    started = true
    if opened { return }
    await withCheckedContinuation { waiters.append($0) }
  }
  func open() {
    opened = true
    waiters.forEach { $0.resume() }
    waiters = []
  }
}

/// Answers by procedure name and records each call's body. A name with no answer fails with 500.
private actor Routes: HTTPTransport {
  private var answers: [String: HTTPResponse]
  private var gates: [String: Gate] = [:]
  private(set) var calls: [(path: String, body: String)] = []
  init(_ answers: [String: String]) {
    self.answers = answers.mapValues { HTTPResponse(statusCode: 200, body: Data($0.utf8)) }
  }
  func send(_ request: HTTPRequest, maximumResponseBytes: Int) async throws -> HTTPResponse {
    let name = request.url.path.replacingOccurrences(of: "/rpc/", with: "")
    if request.url.path.contains("session") {
      return HTTPResponse(statusCode: 200, body: Data(#"{"user":{"id":"u1"}}"#.utf8))
    }
    calls.append((name, request.body.map { String(decoding: $0, as: UTF8.self) } ?? ""))
    if let gate = gates[name] { await gate.wait() }
    return answers[name] ?? HTTPResponse(statusCode: 500)
  }
  /// From now on this procedure fails, like a dropped connection.
  func drop(_ name: String) { answers[name] = nil }
  /// Route a procedure again after a drop, like the connection coming back.
  func answer(_ name: String, _ json: String) {
    answers[name] = HTTPResponse(statusCode: 200, body: Data(json.utf8))
  }
  /// Hold a procedure open until the gate opens, like a slow save.
  func hold(_ name: String, on gate: Gate) { gates[name] = gate }
  func bodies(_ name: String) -> [String] { calls.filter { $0.path == name }.map(\.body) }
}

@MainActor
private func makeApp(_ routes: Routes) async throws -> AppModel {
  let endpoint = URL(string: "http://127.0.0.1:3301")!
  let storage = MemoryStorage()
  storage.session = StoredSession(endpoint: endpoint, token: "synthetic-token")
  let client = AuthClient(endpoint: endpoint, storage: storage, transport: routes)
  let authentication = AuthenticationModel(
    client: client, defaults: UserDefaults(suiteName: UUID().uuidString)!)
  try await client.restore()
  await authentication.sync()
  return AppModel(
    authentication: authentication, transport: routes,
    defaults: UserDefaults(suiteName: UUID().uuidString)!)
}

private func agentsJSON(_ names: [(String, String, String?)]) -> String {
  let items = names.map { id, name, key in
    #"{"id":"\#(id)","name":"\#(name)","spawnKey":\#(key.map { "\"\($0)\"" } ?? "null"),"archivedAt":null}"#
  }
  return #"{"json":[\#(items.joined(separator: ","))]}"#
}

private let roster: [(String, String, String?)] = [
  ("inbox", "Inbox agent", "inbox-agent:u1"), ("chat", "Re: Lunch", "mail-thread:c1:t1"),
  ("b", "Beta", nil), ("c", "Alpha", nil),
]
private let accessJSON = #"{"json":{"allAgents":false,"botIds":["inbox","chat","b"],"agentShared":true}}"#
private let effectiveJSON = #"{"json":{"c1":{"shared":"some","botIds":["inbox","chat","b"]}}}"#

@MainActor
@Test
func theListLoadsStoredAccessAndPinsTheMailGroup() async throws {
  let routes = Routes([
    "bots/list": agentsJSON(roster), "connections/access": accessJSON,
    "connections/effectiveAccess": effectiveJSON,
  ])
  let app = try await makeApp(routes)
  let model = AccessModel(subject: .connection(id: "c1", ownerBotID: "inbox"))
  await model.load(app)
  #expect(model.phase == .loaded && model.shared && !model.everyone)
  #expect(model.layout.mail && model.layout.chats.map(\.id) == ["chat"])
  #expect(model.layout.others.map(\.id) == ["b", "c"])  // on first
}

@MainActor
@Test
func aFailedSaveRevertsTheSwitchAndShowsTheError() async throws {
  // connections/setAccess is not routed, so the save fails with a server error.
  let routes = Routes([
    "bots/list": agentsJSON(roster), "connections/access": accessJSON,
    "connections/effectiveAccess": effectiveJSON,
  ])
  let app = try await makeApp(routes)
  let model = AccessModel(subject: .connection(id: "c1", ownerBotID: "inbox"))
  await model.load(app)
  let alpha = try #require(model.agents.first { $0.id == "c" })
  await model.toggle(app, alpha, on: true)
  #expect(!model.isOn(alpha))
  #expect(model.error != nil)
  #expect(!model.saving)
  #expect(model.layout.others.map(\.id) == ["b", "c"])
}

@MainActor
@Test
func switchingOneAgentSendsOnlyThatAgentAndKeepsRowsStill() async throws {
  let routes = Routes([
    "bots/list": agentsJSON(roster), "connections/access": accessJSON,
    "connections/effectiveAccess": effectiveJSON, "connections/setAgentAccess": accessJSON,
  ])
  let app = try await makeApp(routes)
  let model = AccessModel(subject: .connection(id: "c1", ownerBotID: "inbox"))
  await model.load(app)
  let order = model.layout.others.map(\.id)
  let alpha = try #require(model.agents.first { $0.id == "c" })
  await model.toggle(app, alpha, on: true)
  let sent = try #require(await routes.bodies("connections/setAgentAccess").first)
  #expect(sent.contains(#""botId":"c""#) && sent.contains(#""on":true"#))
  #expect(sent.contains(#""connectionId":"c1""#) && !sent.contains("canWrite"))
  #expect(model.layout.others.map(\.id) == order)
  #expect(model.error == nil)
}

@MainActor
@Test
func allowChangesSendsCanWriteAndRevertsOnFailure() async throws {
  let granted = #"{"json":{"allAgents":false,"botIds":["inbox","chat","b"],"agentShared":true,"writeBotIds":["b"]}}"#
  let routes = Routes([
    "bots/list": agentsJSON(roster), "connections/access": granted,
    "connections/effectiveAccess": effectiveJSON,
  ])
  let app = try await makeApp(routes)
  let model = AccessModel(subject: .connection(id: "c1", ownerBotID: "inbox"))
  await model.load(app)
  let beta = try #require(model.agents.first { $0.id == "b" })
  #expect(model.isWriting(beta))
  await model.toggleWrite(app, beta, on: false)  // setAgentAccess is not routed: the save fails
  #expect(model.isWriting(beta) && model.error != nil)
  // The owner's switch is not editable here.
  let inbox = try #require(model.agents.first { $0.id == "inbox" })
  await model.toggleWrite(app, inbox, on: true)
  #expect(await routes.bodies("connections/setAgentAccess").count == 1)
}

@MainActor
@Test
func noneKeepsTheOwnerAndEmailChats() async throws {
  let routes = Routes([
    "bots/list": agentsJSON(roster), "connections/access": accessJSON,
    "connections/effectiveAccess": effectiveJSON, "connections/setAccess": accessJSON,
  ])
  let app = try await makeApp(routes)
  let model = AccessModel(subject: .connection(id: "c1", ownerBotID: "inbox"))
  await model.load(app)
  await model.setAll(app, on: false)
  let sent = try #require(await routes.bodies("connections/setAccess").first)
  #expect(sent.contains(#""allAgents":false"#) && sent.contains("inbox") && sent.contains("chat"))
  #expect(!sent.contains(#""b""#))
}

@MainActor
@Test
func serverAccessSendsOneAgentAssignment() async throws {
  let server = McpServer(id: "s1", name: "Example", agentBotId: "b", agentExclusive: false)
  let routes = Routes([
    "bots/list": agentsJSON(roster), "mcp/assignments/all": #"{"json":[]}"#,
    "mcp/servers/list": #"{"json":[{"id":"s1","name":"Example","agentBotId":"b","agentExclusive":false}]}"#,
    "mcp/servers/setAgentAssignment": #"{"json":{"ok":true}}"#,
  ])
  let app = try await makeApp(routes)
  let model = AccessModel(subject: .server(server))
  await model.load(app)
  #expect(model.isOn(try #require(model.agents.first { $0.id == "b" })))  // the owner is always on
  await model.toggle(app, try #require(model.agents.first { $0.id == "c" }), on: true)
  let sent = try #require(await routes.bodies("mcp/servers/setAgentAssignment").first)
  #expect(sent.contains(#""serverId":"s1""#) && sent.contains(#""botId":"c""#) && sent.contains(#""on":true"#))
  #expect(await routes.bodies("mcp/assignments/replace").isEmpty)
}

@MainActor
@Test
func anAccountOwnedByAnAgentListsOthersOnlyWhileShared() async throws {
  let routes = Routes([
    "bots/list": agentsJSON(roster),
    "connections/access": #"{"json":{"allAgents":false,"botIds":["b"],"agentShared":false}}"#,
    "connections/effectiveAccess": #"{"json":{"c1":{"shared":"none","botIds":["b"]}}}"#,
    "connections/setExclusive": #"{"json":{"id":"c1"}}"#,
  ])
  let app = try await makeApp(routes)
  let model = AccessModel(subject: .connection(id: "c1", ownerBotID: "b"))
  await model.load(app)
  #expect(!model.showsList)
  await model.setShared(app, true)
  #expect(await routes.bodies("connections/setExclusive").first?.contains(#""exclusive":false"#) == true)
}

@MainActor
@Test
func agentAccessRevertsAFailedSwitch() async throws {
  let routes = Routes([
    "connections/list": #"{"json":[{"id":"c1","connectorId":"composio","provider":"GMAIL","displayName":"Work","account":"me@example.com","status":"connected","error":null,"capabilities":[],"createdAt":"x"}]}"#,
    "mcp/servers/list": #"{"json":[]}"#, "bots/list": agentsJSON(roster),
    "connections/effectiveAccess": #"{"json":{"c1":{"shared":"none","botIds":[]}}}"#,
    "mcp/assignments/list": #"{"json":[]}"#,
    "connections/accessAll": #"{"json":{"c1":{"allAgents":false,"botIds":[],"agentShared":true,"writeBotIds":[]}}}"#,
  ])
  let app = try await makeApp(routes)
  let model = AgentAccessModel(agent: AccessAgent(id: "c", name: "Alpha"))
  await model.load(app)
  let row = try #require(model.rows.first)
  #expect(row.address == "me@example.com" && !row.on && !row.locked)
  await model.toggle(app, row, on: true)  // setAccess is not routed: the save fails
  #expect(model.rows.first?.on == false && model.error != nil)
  #expect(await routes.bodies("connections/access").isEmpty)  // one batched read, not one per account
}

@MainActor
private func agentSide(_ routes: Routes) async throws -> (AgentAccessModel, AppModel) {
  let app = try await makeApp(routes)
  let model = AgentAccessModel(agent: AccessAgent(id: "c", name: "Alpha"))
  await model.load(app)
  return (model, app)
}

private let agentSideRoutes: [String: String] = [
  "connections/list": #"{"json":[{"id":"c1","connectorId":"composio","provider":"GMAIL","displayName":"Work","account":"me@example.com","status":"connected","error":null,"agentBotId":"inbox","writesEnabled":true,"capabilities":[],"createdAt":"x"}]}"#,
  "mcp/servers/list": #"{"json":[]}"#, "bots/list": agentsJSON(roster),
  "connections/effectiveAccess": #"{"json":{"c1":{"shared":"some","botIds":["c"]}}}"#,
  "mcp/assignments/list": #"{"json":[]}"#,
  "connections/accessAll": #"{"json":{"c1":{"allAgents":false,"botIds":["c"],"agentShared":true,"writeBotIds":["c"]}}}"#,
]

@MainActor
@Test
func aFailedSaveAndRefreshStillRestoresTheAgentSwitch() async throws {
  let routes = Routes(agentSideRoutes)
  let (model, app) = try await agentSide(routes)
  let row = try #require(model.rows.first)
  #expect(row.on)
  await routes.drop("connections/setAgentAccess")
  await routes.drop("connections/effectiveAccess")  // the refresh fails too
  await model.toggle(app, row, on: false)
  #expect(model.rows.first?.on == true && model.error != nil)
  await model.toggleWrite(app, try #require(model.rows.first), on: false)
  #expect(model.rows.first?.write?.on == true && model.error != nil)
}

@MainActor
@Test
func aSaveThatLandedButCouldNotRefreshSaysSo() async throws {
  let routes = Routes(agentSideRoutes.merging(["connections/setAgentAccess": accessJSON]) { $1 })
  let (model, app) = try await agentSide(routes)
  await routes.drop("connections/effectiveAccess")
  await model.toggle(app, try #require(model.rows.first), on: false)
  #expect(model.error == "Saved, but the list could not be refreshed")
  let list = Routes([
    "bots/list": agentsJSON(roster), "connections/access": accessJSON,
    "connections/effectiveAccess": effectiveJSON, "connections/setAgentAccess": accessJSON,
  ])
  let account = AccessModel(subject: .connection(id: "c1", ownerBotID: "inbox"))
  let listApp = try await makeApp(list)
  await account.load(listApp)
  await list.drop("connections/effectiveAccess")
  await account.toggle(listApp, try #require(account.agents.first { $0.id == "c" }), on: true)
  #expect(account.error == "Saved, but the list could not be refreshed")
}

@MainActor
@Test
func allOnAnAccountDoesNotShowARestrictedAgentOn() async throws {
  let agents = [
    AccessAgent(id: "inbox", name: "Inbox agent", spawnKey: "inbox-agent:u1"),
    AccessAgent(id: "n", name: "Normal"), AccessAgent(id: "r", name: "Fire", restricted: true),
  ]
  let routes = Routes([
    "connections/setAccess": accessJSON, "connections/access": accessJSON,
    "connections/effectiveAccess": #"{"json":{}}"#,
  ])
  let app = try await makeApp(routes)
  let model = AccessModel(
    subject: .connection(id: "c1", ownerBotID: "inbox"), agents: agents, on: ["inbox"],
    grant: AccessGrant(allAgents: false, botIds: ["inbox"]), shared: true)
  await routes.drop("connections/access")  // the refresh fails: the guess has to be right
  await model.setAll(app, on: true)
  #expect(model.isOn(agents[1]) && !model.isOn(agents[2]))
}

@MainActor
@Test
func noneAlwaysSendsAnExplicitList() async throws {
  let routes = Routes([
    "bots/list": agentsJSON([("inbox", "Inbox agent", "inbox-agent:u1")]),
    "connections/access": accessJSON, "connections/effectiveAccess": effectiveJSON,
    "connections/setAccess": accessJSON,
  ])
  let app = try await makeApp(routes)
  let model = AccessModel(subject: .connection(id: "c1", ownerBotID: "inbox"))
  await model.load(app)
  await model.setAll(app, on: false)
  let sent = try #require(await routes.bodies("connections/setAccess").first)
  #expect(sent.contains(#""allAgents":false"#) && sent.contains(#""botIds":["inbox"]"#))
}

@MainActor
@Test
func serversDeriveEveryoneFromAssignmentsAndDoNotLockChats() async throws {
  let server = McpServer(id: "s1", name: "Example", agentBotId: "b")
  let everyoneIn = Routes([
    "bots/list": agentsJSON(roster),
    "mcp/assignments/all": #"{"json":[{"botId":"inbox","serverId":"s1","allowAllTools":true,"allowedTools":[]},{"botId":"chat","serverId":"s1","allowAllTools":true,"allowedTools":[]},{"botId":"c","serverId":"s1","allowAllTools":true,"allowedTools":[]}]}"#,
    "mcp/servers/list": #"{"json":[{"id":"s1","name":"Example","agentBotId":"b"}]}"#,
  ])
  let app = try await makeApp(everyoneIn)
  let model = AccessModel(subject: .server(server))
  await model.load(app)
  #expect(model.everyone && !model.chatsLocked)  // the owner b is always on
  let some = Routes([
    "bots/list": agentsJSON(roster), "mcp/assignments/all": #"{"json":[]}"#,
    "mcp/servers/list": #"{"json":[{"id":"s1","name":"Example","agentBotId":"b"}]}"#,
  ])
  let partial = AccessModel(subject: .server(server))
  await partial.load(try await makeApp(some))
  #expect(!partial.everyone)
  #expect(AccessModel(subject: .connection(id: "c1", ownerBotID: "inbox")).chatsLocked)
}

// MARK: Screenshots

/// Draws a view in a window and saves a PNG when `ACCESS_SHOTS` names a folder.
@MainActor
private func shot<V: View>(_ view: V, name: String, large: Bool, height: CGFloat = 1500) async {
  let size = CGSize(width: 402, height: height)
  let scene = UIApplication.shared.connectedScenes.compactMap { $0 as? UIWindowScene }.first
  let window = scene.map { UIWindow(windowScene: $0) } ?? UIWindow()
  window.frame = CGRect(origin: .zero, size: size)
  defer { window.isHidden = true }  // a window left visible covers the screen for later tests
  let styled = view.dynamicTypeSize(large ? .accessibility2 : .large)
  window.rootViewController = UIHostingController(rootView: styled)
  window.isHidden = false
  window.layoutIfNeeded()
  try? await Task.sleep(for: .seconds(1))
  window.layoutIfNeeded()
  guard let folder = ProcessInfo.processInfo.environment["ACCESS_SHOTS"] else { return }
  let image = UIGraphicsImageRenderer(size: size).image { _ in
    window.drawHierarchy(in: CGRect(origin: .zero, size: size), afterScreenUpdates: true)
  }
  try? FileManager.default.createDirectory(atPath: folder, withIntermediateDirectories: true)
  let suffix = large ? "large" : "default"
  try? image.pngData()?.write(
    to: URL(fileURLWithPath: folder).appendingPathComponent("\(name)-\(suffix).png"))
}

private func manyAgents(_ count: Int) -> [AccessAgent] {
  let named = [
    "Researcher", "Writer", "Scheduler", "Analyst", "Legal", "Finance", "Recruiter", "Support",
    "Planner", "Editor", "Designer", "Reviewer",
  ]
  return named.prefix(count).enumerated().map { AccessAgent(id: "a\($0.offset)", name: $0.element) }
}

@MainActor
@Test
func rendersTheAccessScreens() async throws {
  let routes = Routes([:])
  let app = try await makeApp(routes)
  let mail = [
    AccessAgent(id: "inbox", name: "Inbox agent", spawnKey: "inbox-agent:u1"),
    AccessAgent(id: "chat1", name: "Re: Lunch", spawnKey: "mail-thread:c1:t1"),
    AccessAgent(id: "chat2", name: "Re: Offer", spawnKey: "mail-thread:c1:t2"),
  ]
  for large in [false, true] {
    // A mail account with a few agents: pinned group, then Other agents.
    let few = AccessModel(
      subject: .connection(id: "c1", ownerBotID: "inbox"), agents: mail + manyAgents(4),
      on: ["inbox", "chat1", "a0", "a2"],
      grant: AccessGrant(allAgents: false, botIds: ["inbox", "chat1", "a0", "a2"]), shared: true,
      writers: ["a0"])
    await shot(
      NavigationStack {
        Form { AccessSections(model: few, name: "Founder mail", subtext: "Which agents can use this account.", writesEnabled: true) }
          .navigationTitle("Founder mail").navigationBarTitleDisplayMode(.inline)
      }.environment(app),
      name: "account-access", large: large, height: large ? 1900 : 1100)
    // Twelve agents: search and filter appear.
    let many = AccessModel(
      subject: .connection(id: "c2", ownerBotID: nil), agents: manyAgents(12),
      on: ["a3", "a1"], grant: AccessGrant(allAgents: false, botIds: ["a3", "a1"]), shared: true)
    await shot(
      NavigationStack {
        Form { AccessSections(model: many, name: "Support mail", subtext: "Which agents can use this account.") }
          .accessControls(many)
          .navigationTitle("Support mail").navigationBarTitleDisplayMode(.inline)
      }.environment(app),
      name: "account-access-many", large: large, height: large ? 2600 : 1300)
    // An agent-linked server that is not shared: only the switch.
    let server = McpServer(id: "s1", name: "Example MCP", agentBotId: "a0", agentExclusive: true)
    let closed = AccessModel(
      subject: .server(server), agents: manyAgents(4), on: ["a0"],
      grant: AccessGrant(allAgents: true, botIds: []), shared: false)
    await shot(
      NavigationStack {
        Form { AccessSections(model: closed, name: "Example MCP", subtext: "Which agents can use this connection.") }
          .navigationTitle("Example MCP").navigationBarTitleDisplayMode(.inline)
      }.environment(app),
      name: "server-access-private", large: large, height: large ? 900 : 500)
    // The agent's own Access list.
    let rows = [
      AccessLogic.Row(id: "connection:c1", kind: .connection, refID: "c1", name: "Founder mail", address: "founder@example.com", on: true, locked: true, write: .init(on: true, fixed: true, enabled: true)),
      AccessLogic.Row(id: "connection:c3", kind: .connection, refID: "c3", name: "Sales mail", address: "sales@example.com", on: true, limited: true, locked: false, write: .init(on: false, fixed: false, enabled: true)),
      AccessLogic.Row(id: "connection:c2", kind: .connection, refID: "c2", name: "Support mail", address: "support@example.com", on: false, locked: false),
      AccessLogic.Row(id: "server:s1", kind: .server, refID: "s1", name: "Example MCP", address: nil, on: true, locked: false),
    ]
    let agentModel = AgentAccessModel(agent: AccessAgent(id: "a0", name: "Researcher"), rows: rows)
    await shot(
      NavigationStack {
        Form { AgentAccessSection(model: agentModel) }
          .navigationTitle("Agent settings").navigationBarTitleDisplayMode(.inline)
      }.environment(app),
      name: "agent-access", large: large, height: large ? 1000 : 520)
  }
}

private let rulesRoutes = [
  "approvalRules/list": #"{"json":[]}"#,
  "autoReview/get": #"{"json":{"enabled":true,"checkerAvailable":true}}"#,
]

@MainActor
@Test
func permissionsLoadTheDefaultAndSaveTheChosenLevel() async throws {
  let routes = Routes(
    rulesRoutes.merging([
      "permissions/get": #"{"json":{"level":null,"effectiveDefault":"open"}}"#,
      "permissions/set": #"{"json":{"level":"ask_changes","effectiveDefault":"open"}}"#,
    ]) { $1 })
  let app = try await makeApp(routes)
  let model = RulesModel()
  await model.load(app)
  #expect(model.state.value?.permissions.effective == "open")
  await model.setPermission(app, "ask_changes")
  #expect(try #require(await routes.bodies("permissions/set").first).contains(#""level":"ask_changes""#))
  #expect(model.permissionError == nil)
}

@MainActor
@Test
func aFailedPermissionSaveKeepsTheOldLevelAndShowsTheError() async throws {
  // permissions/set is not routed, so the save fails with a server error.
  let routes = Routes(
    rulesRoutes.merging(["permissions/get": #"{"json":{"level":"open","effectiveDefault":"open"}}"#]) { $1 })
  let app = try await makeApp(routes)
  let model = RulesModel()
  await model.load(app)
  await model.setPermission(app, "ask_everything")
  #expect(model.state.value?.permissions.effective == "open")
  #expect(model.permissionError != nil)
}

@Test
func aClearedPermissionLevelEncodesAsNull() throws {
  // permissions/set requires the level key: a reset is {"level":null}, not a missing key.
  let reset = String(decoding: try JSONEncoder().encode(PermissionInput(level: nil)), as: UTF8.self)
  #expect(reset.contains(#""level":null"#))
  let chosen = String(
    decoding: try JSONEncoder().encode(PermissionInput(level: "open")), as: UTF8.self)
  #expect(chosen.contains(#""level":"open""#))
}

@MainActor
@Test
func restoringThePermissionDefaultSendsNullAndAnExplicitMatchSendsItsLevel() async throws {
  let routes = Routes(
    rulesRoutes.merging([
      "permissions/get": #"{"json":{"level":"open","effectiveDefault":"open"}}"#,
      "permissions/set": #"{"json":{"level":null,"effectiveDefault":"open"}}"#,
    ]) { $1 })
  let app = try await makeApp(routes)
  let model = RulesModel()
  await model.load(app)
  // Choosing the level that happens to equal the deployment default stays an explicit override.
  await model.setPermission(app, "open")
  #expect(try #require(await routes.bodies("permissions/set").last).contains(#""level":"open""#))
  // Restoring the default sends null explicitly; a missing key would leave the override in place.
  await model.setPermission(app, nil)
  #expect(try #require(await routes.bodies("permissions/set").last).contains(#""level":null"#))
}

@MainActor
@Test
func aSecondPermissionSaveIsIgnoredWhileOneIsInFlight() async throws {
  let gate = Gate()
  let routes = Routes(
    rulesRoutes.merging([
      "permissions/get": #"{"json":{"level":"ask_changes","effectiveDefault":"open"}}"#,
      "permissions/set": #"{"json":{"level":"ask_changes","effectiveDefault":"open"}}"#,
    ]) { $1 })
  await routes.hold("permissions/set", on: gate)
  let app = try await makeApp(routes)
  let model = RulesModel()
  await model.load(app)
  async let first: Void = model.setPermission(app, "ask_changes")
  while !(await gate.started) { await Task.yield() }
  async let second: Void = model.setPermission(app, "ask_everything")
  await gate.open()
  await first
  await second
  #expect(await routes.bodies("permissions/set").count == 1)
  #expect(model.state.value?.permissions.level == "ask_changes")
}

@MainActor
@Test
func aFailedPermissionSaveLetsTheNextSaveThrough() async throws {
  // permissions/set is unrouted at first, so the save fails with a server error.
  let routes = Routes(
    rulesRoutes.merging(["permissions/get": #"{"json":{"level":"open","effectiveDefault":"open"}}"#]) { $1 })
  let app = try await makeApp(routes)
  let model = RulesModel()
  await model.load(app)
  await model.setPermission(app, "ask_everything")
  #expect(model.permissionError != nil)
  await routes.answer(
    "permissions/set", #"{"json":{"level":"ask_everything","effectiveDefault":"open"}}"#)
  await model.setPermission(app, "ask_everything")
  #expect(model.permissionError == nil)
  #expect(model.state.value?.permissions.effective == "ask_everything")
}
