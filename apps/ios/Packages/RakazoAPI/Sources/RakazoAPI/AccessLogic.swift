import Foundation

/// The pure rules behind the Access lists, kept apart from the screens so they can be tested.
public enum AccessLogic {
  public static let accountNameLimit = 60
  public static let serverNameLimit = 120
  /// Search and the On/Off filter appear once a list is longer than this.
  public static let controlsMinimum = 8

  /// The trimmed name when it is 1 to `limit` characters long, otherwise nil.
  public static func validName(_ text: String, limit: Int = accountNameLimit) -> String? {
    let name = text.trimmingCharacters(in: .whitespacesAndNewlines)
    return (1...limit).contains(name.count) ? name : nil
  }

  /// All or None for the agents outside `keep`. The kept agents stay exactly as they are.
  public static func setOthers(
    _ current: AccessGrant, allBotIDs: [String], keep: [String], on: Bool
  ) -> AccessGrant {
    let kept = Set(keep)
    var ids = Set((current.allAgents ? allBotIDs : current.botIds).filter(kept.contains))
    if on { ids.formUnion(allBotIDs.filter { !kept.contains($0) }) }
    // None is always an explicit list, so agents made later are not eligible.
    return on ? collapse(ids, allBotIDs) : AccessGrant(allAgents: false, botIds: ids.sorted())
  }

  private static func collapse(_ ids: Set<String>, _ allBotIDs: [String]) -> AccessGrant {
    let all = allBotIDs.allSatisfy(ids.contains)
    // Sorted so the same grant always encodes the same way.
    return AccessGrant(allAgents: all, botIds: all ? [] : ids.sorted())
  }

  /// The agents All and None leave alone: the owner and, on a mail account, its email chats.
  public static func keptIDs(agents: [AccessAgent], ownerID: String?) -> [String] {
    guard let ownerID else { return [] }
    let owner = agents.first { $0.id == ownerID }
    let chats = owner?.isInboxAgent == true ? agents.filter(\.isMailChat).map(\.id) : []
    return [ownerID] + chats
  }

  public enum Filter: String, Sendable, CaseIterable { case all, on, off }

  /// What one Access list shows, top to bottom.
  public struct Layout: Sendable, Equatable {
    /// The connection's own agent, pinned first.
    public var owner: AccessAgent?
    /// Email chats are one row; only on a mail account.
    public var chats: [AccessAgent]
    public var others: [AccessAgent]

    public init(owner: AccessAgent?, chats: [AccessAgent], others: [AccessAgent]) {
      self.owner = owner
      self.chats = chats
      self.others = others
    }
    /// On a mail account the Inbox agent and email chats sit apart, above "Other agents".
    public var mail: Bool { owner?.isInboxAgent == true }
  }

  /// Splits the agents into the pinned group and the rest. `others` are searched by name, filtered
  /// and ordered on-first then by name from `on` as it is when this is called; the caller keeps
  /// the result while switches flip, so a row never jumps under the finger.
  public static func layout(
    agents: [AccessAgent], ownerID: String?, on: Set<String>, query: String = "",
    filter: Filter = .all
  ) -> Layout {
    let owner = agents.first { $0.id == ownerID }
    let chats = agents.filter(\.isMailChat)
    let needle = query.trimmingCharacters(in: .whitespaces).lowercased()
    let others = agents
      .filter { !$0.isMailChat && $0.id != ownerID }
      .filter { needle.isEmpty || $0.name.lowercased().contains(needle) }
      .filter {
        switch filter {
        case .all: true
        case .on: on.contains($0.id)
        case .off: !on.contains($0.id)
        }
      }
      .sorted {
        let (a, b) = (on.contains($0.id), on.contains($1.id))
        return a != b ? a : $0.name.localizedCaseInsensitiveCompare($1.name) == .orderedAscending
      }
    return Layout(owner: owner, chats: chats, others: others)
  }

  /// One account or server in an agent's own Access list.
  public struct Row: Sendable, Hashable, Identifiable {
    public enum Kind: Sendable, Hashable { case connection, server }
    /// "Allow changes" under an account that has its own agent.
    public struct Write: Sendable, Hashable {
      public var on: Bool
      /// The account's own agent follows the account's switch and cannot be edited here.
      public let fixed: Bool
      /// The account's own "Allow changes" switch gates every agent's.
      public let enabled: Bool

      public init(on: Bool, fixed: Bool, enabled: Bool) {
        self.on = on
        self.fixed = fixed
        self.enabled = enabled
      }
    }

    public let id: String
    public let kind: Kind
    public let refID: String
    public let name: String
    public let address: String?
    public var on: Bool
    /// The grant is saved but another account of the same app limits access, so it has no effect.
    public let limited: Bool
    /// The agent cannot change it: it is the account's own agent, an email chat (which follows the
    /// Inbox agent), an account not shared with other agents, or a server only its agent may use.
    public let locked: Bool
    public var write: Write?

    public init(
      id: String, kind: Kind, refID: String, name: String, address: String?, on: Bool,
      limited: Bool = false, locked: Bool, write: Write? = nil
    ) {
      self.id = id
      self.kind = kind
      self.refID = refID
      self.name = name
      self.address = address
      self.on = on
      self.limited = limited
      self.locked = locked
      self.write = write
    }
  }

  /// The accounts and servers one agent can reach, ordered by name then address. An account's
  /// switch shows the stored grant, so it can always be revoked; "all agents" does not reach a
  /// restricted agent. Email chats only follow the Inbox agent; they have no switches of their own.
  public static func rows(
    for agent: AccessAgent, connections: [Connection], servers: [McpServer],
    effective: [String: EffectiveAccess], accesses: [String: ConnectionAccess],
    assigned: Set<String>
  ) -> [Row] {
    let mailChat = agent.isMailChat
    let accounts = connections.filter { $0.isConnected && !$0.needsReconnect }.map { connection in
      let own = connection.agentBotId == agent.id
      let stored = accesses[connection.id]
      let privateToOwner = connection.agentBotId != nil && !own && stored?.agentShared == false
      let effectiveOn = effective[connection.id]?.botIds.contains(agent.id) ?? false
      let granted =
        own
        || (stored.map {
          ($0.allAgents && !agent.restricted) || $0.botIds.contains(agent.id)
        } ?? effectiveOn)
      let on = mailChat || privateToOwner ? effectiveOn : granted
      let write: Row.Write? =
        connection.agentBotId != nil && !mailChat
        ? Row.Write(
          on: own ? connection.writesEnabled : stored?.writeBotIds.contains(agent.id) ?? false,
          fixed: own, enabled: connection.writesEnabled)
        : nil
      return Row(
        id: "connection:\(connection.id)", kind: .connection, refID: connection.id,
        name: connection.displayName, address: connection.account, on: on,
        limited: on && !effectiveOn && !mailChat && !privateToOwner,
        locked: own || mailChat || privateToOwner, write: write)
    }
    let mcp = servers.filter(\.enabled).map { server in
      let own = server.agentBotId == agent.id
      // Only its agent may use an exclusive server, whatever the saved assignments say.
      let exclusiveOther = server.agentBotId != nil && server.agentExclusive && !own
      return Row(
        id: "server:\(server.id)", kind: .server, refID: server.id, name: server.name,
        address: nil, on: own || (!exclusiveOther && assigned.contains(server.id)),
        locked: own || exclusiveOther)
    }
    return (accounts + mcp).sorted {
      let byName = $0.name.localizedCaseInsensitiveCompare($1.name)
      if byName != .orderedSame { return byName == .orderedAscending }
      return ($0.address ?? "").localizedCaseInsensitiveCompare($1.address ?? "") == .orderedAscending
    }
  }
}
