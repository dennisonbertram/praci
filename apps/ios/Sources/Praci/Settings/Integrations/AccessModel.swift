import Foundation
import Observation
import RakazoAPI

private struct BotRef: Encodable, Sendable { let botId: String }
private struct ConnectionRef: Encodable, Sendable { let connectionId: String }
private struct SetAccessInput: Encodable, Sendable {
  let connectionId: String
  let allAgents: Bool
  let botIds: [String]
}
private struct SetExclusiveInput: Encodable, Sendable {
  let connectionId: String
  let exclusive: Bool
}
private struct ServerExclusiveInput: Encodable, Sendable {
  let serverId: String
  let exclusive: Bool
}
private struct AgentAccessInput: Encodable, Sendable {
  let connectionId: String
  let botId: String
  let on: Bool
  /// Left out, an agent already on keeps its setting and a new one starts read-only.
  var canWrite: Bool?
}
private struct AgentAssignmentInput: Encodable, Sendable {
  let serverId: String
  let botId: String
  let on: Bool
}
private struct ServerWritesInput: Encodable, Sendable {
  let id: String
  let enabled: Bool
}

/// Procedure calls shared by the account, server and agent Access lists.
@MainActor
enum AccessClient {
  static func agents(_ app: AppModel) async throws -> [AccessAgent] {
    let all: [AccessAgent] = try await app.call("bots/list")
    return all.filter { $0.archivedAt == nil }
  }

  static func access(_ app: AppModel, connection: String) async throws -> ConnectionAccess {
    try await app.call("connections/access", input: ConnectionRef(connectionId: connection))
  }

  static func effective(_ app: AppModel) async throws -> [String: EffectiveAccess] {
    try await app.call("connections/effectiveAccess")
  }

  static func setAccess(_ app: AppModel, connection: String, _ grant: AccessGrant) async throws {
    let _: ConnectionAccess = try await app.call(
      "connections/setAccess",
      input: SetAccessInput(
        connectionId: connection, allAgents: grant.allAgents, botIds: grant.botIds))
  }

  /// The stored access of every live connection, in one call.
  static func accessAll(_ app: AppModel) async throws -> [String: ConnectionAccess] {
    try await app.call("connections/accessAll")
  }

  /// Switches one agent on or off for one account, or sets its "Allow changes", atomically on the
  /// server. Only this agent's grant changes.
  static func setAgentAccess(
    _ app: AppModel, connection: String, botID: String, on: Bool, canWrite: Bool? = nil
  ) async throws {
    let _: ConnectionAccess = try await app.call(
      "connections/setAgentAccess",
      input: AgentAccessInput(connectionId: connection, botId: botID, on: on, canWrite: canWrite))
  }

  static func servers(_ app: AppModel) async throws -> [McpServer] {
    try await app.call("mcp/servers/list")
  }

  /// Gives one agent a server or takes it away, atomically on the server.
  static func assign(_ app: AppModel, botID: String, serverID: String, on: Bool) async throws {
    let _: OKResult = try await app.call(
      "mcp/servers/setAgentAssignment",
      input: AgentAssignmentInput(serverId: serverID, botId: botID, on: on))
  }

  static func assigned(_ app: AppModel, botID: String) async throws -> Set<String> {
    let list: [McpAssignment] = try await app.call(
      "mcp/assignments/list", input: BotRef(botId: botID))
    return Set(list.map(\.serverId))
  }

  static func setShared(_ app: AppModel, connection: String, shared: Bool) async throws {
    let _: Connection = try await app.call(
      "connections/setExclusive",
      input: SetExclusiveInput(connectionId: connection, exclusive: !shared))
  }

  static func setServerShared(_ app: AppModel, server: McpServer, shared: Bool) async throws {
    let _: McpServer = try await app.call(
      "integrationAgents/setExclusive",
      input: ServerExclusiveInput(serverId: server.id, exclusive: !shared))
    // Other agents' rows stay on the server, so turning sharing back on restores them.
    if !shared, let owner = server.agentBotId,
      !(try await assigned(app, botID: owner)).contains(server.id)
    {
      try await assign(app, botID: owner, serverID: server.id, on: true)
    }
  }

  static func setServerWrites(_ app: AppModel, server: String, enabled: Bool) async throws {
    let _: McpServer = try await app.call(
      "mcp/servers/setWrites", input: ServerWritesInput(id: server, enabled: enabled))
  }
}

/// What one account or server lets agents do: the Access list on its detail screen.
@MainActor
@Observable
final class AccessModel {
  enum Subject: Equatable {
    case connection(id: String, ownerBotID: String?)
    case server(McpServer)

    var ownerBotID: String? {
      switch self {
      case .connection(_, let owner): owner
      case .server(let server): server.agentBotId
      }
    }
  }

  enum Phase: Equatable {
    case loading
    case loaded
    case failed(String)
  }

  let subject: Subject
  private(set) var phase = Phase.loading
  private(set) var agents: [AccessAgent] = []
  private(set) var on: Set<String> = []
  /// Agents granted "Allow changes" on this account.
  private(set) var writers: Set<String> = []
  private(set) var grant = AccessGrant(allAgents: true, botIds: [])
  /// "Let other agents use it": only meaningful when the subject has its own agent.
  private(set) var shared = true
  private(set) var saving = false
  private(set) var layout = AccessLogic.Layout(owner: nil, chats: [], others: [])
  var error: String?
  var query = "" { didSet { arrange() } }
  var filter = AccessLogic.Filter.all { didSet { arrange() } }

  init(subject: Subject) { self.subject = subject }

  /// For previews and tests: a loaded model without a server.
  init(
    subject: Subject, agents: [AccessAgent], on: Set<String>, grant: AccessGrant, shared: Bool,
    writers: Set<String> = []
  ) {
    self.writers = writers
    self.subject = subject
    self.agents = agents
    self.on = on
    self.grant = grant
    self.shared = shared
    phase = .loaded
    arrange()
  }

  /// Zernio and Brex cards have no "Let other agents use … directly" choice.
  var sharingHidden: Bool {
    if case .server(let server) = subject { server.hidesSharing } else { false }
  }
  var hasOwner: Bool { subject.ownerBotID != nil }
  /// With its own agent an account lists agents only while it is shared.
  var showsList: Bool { !hasOwner || (shared && !sharingHidden) }
  var showsControls: Bool { agents.count > AccessLogic.controlsMinimum }
  private var allBotIDs: [String] { agents.map(\.id) }
  private var keptIDs: [String] {
    AccessLogic.keptIDs(agents: agents, ownerID: subject.ownerBotID)
  }

  /// Every agent can use it. A server has no "all agents" grant, so it is read from the assignments.
  var everyone: Bool {
    if case .server = subject { return agents.allSatisfy { on.contains($0.id) } }
    return grant.allAgents
  }
  /// An email chat has the Inbox agent's access, so on an account it only follows. MCP
  /// assignments are independent of the Inbox agent.
  var chatsLocked: Bool {
    if case .connection = subject { true } else { false }
  }
  var noneOn: Bool {
    agents.allSatisfy { keptIDs.contains($0.id) || !on.contains($0.id) }
  }

  func isOn(_ agent: AccessAgent) -> Bool { on.contains(agent.id) }

  func load(_ app: AppModel) async {
    phase = .loading
    do {
      agents = try await AccessClient.agents(app)
      try await fetch(app)
      phase = .loaded
      arrange()
    } catch {
      phase = .failed(settingsErrorText(error))
    }
  }

  /// Reads the stored state again without moving any row.
  private func fetch(_ app: AppModel) async throws {
    switch subject {
    case .connection(let id, _):
      async let access = AccessClient.access(app, connection: id)
      async let effective = AccessClient.effective(app)
      let stored = try await access
      grant = stored.grant
      shared = stored.agentShared
      writers = Set(stored.writeBotIds)
      on = Set(try await effective[id]?.botIds ?? agents.map(\.id))
    case .server(let server):
      let all: [McpAssignment] = try await app.call("mcp/assignments/all")
      var next = Set(all.filter { $0.serverId == server.id }.map(\.botId))
      if let owner = server.agentBotId { next.insert(owner) }
      on = next
      if let fresh = try await AccessClient.servers(app).first(where: { $0.id == server.id }) {
        shared = !fresh.agentExclusive
      }
    }
  }

  private func arrange() {
    layout = AccessLogic.layout(
      agents: agents, ownerID: subject.ownerBotID, on: on,
      query: showsControls ? query : "", filter: showsControls ? filter : .all)
  }

  func toggle(_ app: AppModel, _ agent: AccessAgent, on next: Bool) async {
    guard agent.id != subject.ownerBotID else { return }
    await save(app) {
      self.setLocal([agent.id], next)
      try await self.write(app, agents: [agent.id], on: next)
    }
  }

  func isWriting(_ agent: AccessAgent) -> Bool { writers.contains(agent.id) }

  /// "Allow changes" for one granted agent.
  func toggleWrite(_ app: AppModel, _ agent: AccessAgent, on next: Bool) async {
    guard case .connection(let id, _) = subject, agent.id != subject.ownerBotID else { return }
    await save(app) {
      if next { self.writers.insert(agent.id) } else { self.writers.remove(agent.id) }
      try await AccessClient.setAgentAccess(
        app, connection: id, botID: agent.id, on: true, canWrite: next)
    }
  }

  func toggleChats(_ app: AppModel, on next: Bool) async {
    let ids = layout.chats.map(\.id)
    await save(app) {
      self.setLocal(ids, next)
      try await self.write(app, agents: ids, on: next)
    }
  }

  func setAll(_ app: AppModel, on next: Bool) async {
    let keep = Set(keptIDs)
    let ids = agents.map(\.id).filter { !keep.contains($0) }
    let changing = ids.filter { on.contains($0) != next }
    // "All agents" does not reach a restricted agent, so it is not shown on.
    let restricted = Set(agents.filter(\.restricted).map(\.id))
    let reached = ids.filter { !next || !restricted.contains($0) }
    await save(app) {
      self.setLocal(reached, next)
      switch self.subject {
      case .connection(let id, _):
        let value = AccessLogic.setOthers(
          self.grant, allBotIDs: self.allBotIDs, keep: self.keptIDs, on: next)
        try await AccessClient.setAccess(app, connection: id, value)
      case .server:
        for id in changing { try await self.write(app, agents: [id], on: next) }
      }
    }
  }

  func setShared(_ app: AppModel, _ value: Bool) async {
    await save(app) {
      self.shared = value
      switch self.subject {
      case .connection(let id, _): try await AccessClient.setShared(app, connection: id, shared: value)
      case .server(let server): try await AccessClient.setServerShared(app, server: server, shared: value)
      }
    }
  }

  private func setLocal(_ ids: [String], _ next: Bool) {
    if next { on.formUnion(ids) } else { on.subtract(ids) }
  }

  private func write(_ app: AppModel, agents ids: [String], on next: Bool) async throws {
    switch subject {
    case .connection(let id, _):
      for botID in ids {
        try await AccessClient.setAgentAccess(app, connection: id, botID: botID, on: next)
      }
    case .server(let server):
      for botID in ids { try await AccessClient.assign(app, botID: botID, serverID: server.id, on: next) }
    }
  }

  /// Shows the change at once. If the save fails, the switch goes back and the error shows.
  private func save(_ app: AppModel, _ work: @escaping () async throws -> Void) async {
    guard !saving else { return }
    saving = true
    error = nil
    let (before, sharedBefore, writersBefore) = (on, shared, writers)
    do {
      try await work()
    } catch {
      (on, shared, writers) = (before, sharedBefore, writersBefore)
      self.error = settingsErrorText(error)
    }
    // Rows stay where they are; only the switches follow the server.
    do {
      try await fetch(app)
    } catch where self.error == nil {
      // The change landed but the switches no longer show what the server has.
      self.error = String(localized: "Saved, but the list could not be refreshed")
    } catch {}
    saving = false
  }
}
