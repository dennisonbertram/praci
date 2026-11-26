import Foundation

/// One agent as listed by `rpc_bots_list`, as far as access screens need it.
public struct AccessAgent: Sendable, Hashable, Decodable, Identifiable {
  public let id: String
  public let name: String
  public let color: String?
  public let spawnKey: String?
  public let archivedAt: String?
  /// A firewalled or external agent: "all agents" does not reach it, it needs an explicit grant.
  public let restricted: Bool

  private enum CodingKeys: String, CodingKey {
    case id, name, color, spawnKey, archivedAt, audience, firewall
  }

  public init(from decoder: Decoder) throws {
    let c = try decoder.container(keyedBy: CodingKeys.self)
    id = try c.decode(String.self, forKey: .id)
    name = try c.decode(String.self, forKey: .name)
    color = try c.decodeIfPresent(String.self, forKey: .color)
    spawnKey = try c.decodeIfPresent(String.self, forKey: .spawnKey)
    archivedAt = try c.decodeIfPresent(String.self, forKey: .archivedAt)
    let audience = try c.decodeIfPresent(String.self, forKey: .audience)
    let firewall = try c.decodeIfPresent(Bool.self, forKey: .firewall) ?? false
    restricted = audience == "external" || firewall
  }

  /// The agent made for one email conversation.
  public var isMailChat: Bool { spawnKey?.hasPrefix("mail-thread:") ?? false }
  public var isInboxAgent: Bool { spawnKey?.hasPrefix("inbox-agent:") ?? false }

  public init(
    id: String, name: String, color: String? = nil, spawnKey: String? = nil,
    archivedAt: String? = nil, restricted: Bool = false
  ) {
    self.restricted = restricted
    self.id = id
    self.name = name
    self.color = color
    self.spawnKey = spawnKey
    self.archivedAt = archivedAt
  }
}

/// `rpc_connections_access` output (and `_setAccess`): the stored grant of one connection.
public struct ConnectionAccess: Sendable, Hashable, Decodable {
  public let allAgents: Bool
  public let botIds: [String]
  /// The "Let other agents use it" switch of an agent-linked connection.
  public let agentShared: Bool
  /// Granted agents that may also make changes (each still asks), while the connection's own
  /// "Allow changes" switch is on.
  public let writeBotIds: [String]

  public init(allAgents: Bool, botIds: [String], agentShared: Bool, writeBotIds: [String] = []) {
    self.allAgents = allAgents
    self.botIds = botIds
    self.agentShared = agentShared
    self.writeBotIds = writeBotIds
  }

  private enum CodingKeys: String, CodingKey { case allAgents, botIds, agentShared, writeBotIds }

  public init(from decoder: Decoder) throws {
    let c = try decoder.container(keyedBy: CodingKeys.self)
    allAgents = try c.decode(Bool.self, forKey: .allAgents)
    botIds = try c.decode([String].self, forKey: .botIds)
    agentShared = try c.decodeIfPresent(Bool.self, forKey: .agentShared) ?? true
    writeBotIds = try c.decodeIfPresent([String].self, forKey: .writeBotIds) ?? []
  }

  public var grant: AccessGrant { AccessGrant(allAgents: allAgents, botIds: botIds) }
}

/// One entry of `rpc_connections_effectiveAccess`: who can really use a connection.
public struct EffectiveAccess: Sendable, Hashable, Decodable {
  public let shared: String
  public let botIds: [String]

  public init(shared: String, botIds: [String]) {
    self.shared = shared
    self.botIds = botIds
  }
}

/// The `allAgents` and `botIds` pair that `rpc_connections_setAccess` takes.
public struct AccessGrant: Sendable, Hashable, Codable {
  public var allAgents: Bool
  public var botIds: [String]

  public init(allAgents: Bool, botIds: [String]) {
    self.allAgents = allAgents
    self.botIds = botIds
  }
}

/// `rpc_mcp_servers_list` item, as far as access screens need it.
public struct McpServer: Sendable, Hashable, Decodable, Identifiable {
  public let id: String
  public let name: String
  public let enabled: Bool
  public let writesEnabled: Bool
  public let oauthStatus: String
  /// A sign-in was started and never finished.
  public let oauthAttempted: Bool
  /// False when the server would never get the token (plain-HTTP loopback).
  public let oauthSupported: Bool
  public let transport: String
  public let endpoint: String?
  public let agentBotId: String?
  /// While true, only the agent may use the server.
  public let agentExclusive: Bool

  public init(
    id: String, name: String, enabled: Bool = true, writesEnabled: Bool = false,
    oauthStatus: String = "none", oauthAttempted: Bool = false, oauthSupported: Bool = true,
    transport: String = "streamable_http",
    endpoint: String? = nil, agentBotId: String? = nil,
    agentExclusive: Bool = false
  ) {
    self.endpoint = endpoint
    self.id = id
    self.name = name
    self.enabled = enabled
    self.writesEnabled = writesEnabled
    self.oauthStatus = oauthStatus
    self.oauthAttempted = oauthAttempted
    self.oauthSupported = oauthSupported
    self.transport = transport
    self.agentBotId = agentBotId
    self.agentExclusive = agentExclusive
  }

  private func host(is name: String) -> Bool {
    guard let endpoint, let url = URL(string: endpoint) else { return false }
    return url.scheme == "https" && url.host == name
  }

  /// The "Let other agents use … directly" switch is not offered for Zernio and Brex cards.
  public var hidesSharing: Bool { host(is: "mcp.zernio.com") || endpoint == "rakazo+brex://cards" }
  /// The "Allow changes" switch is not offered for Devin, Granola and Zernio.
  public var hidesWrites: Bool {
    host(is: "mcp.devin.ai") || host(is: "mcp.granola.ai") || host(is: "mcp.zernio.com")
  }

  private enum CodingKeys: String, CodingKey {
    case id, name, enabled, writesEnabled, oauthStatus, oauthAttempted, oauthSupported, transport, endpoint, agentBotId
    case agentExclusive
  }

  public init(from decoder: Decoder) throws {
    let c = try decoder.container(keyedBy: CodingKeys.self)
    id = try c.decode(String.self, forKey: .id)
    name = try c.decode(String.self, forKey: .name)
    enabled = try c.decodeIfPresent(Bool.self, forKey: .enabled) ?? true
    writesEnabled = try c.decodeIfPresent(Bool.self, forKey: .writesEnabled) ?? false
    oauthStatus = try c.decodeIfPresent(String.self, forKey: .oauthStatus) ?? "none"
    oauthAttempted = try c.decodeIfPresent(Bool.self, forKey: .oauthAttempted) ?? false
    oauthSupported = try c.decodeIfPresent(Bool.self, forKey: .oauthSupported) ?? true
    transport = try c.decodeIfPresent(String.self, forKey: .transport) ?? "streamable_http"
    endpoint = try c.decodeIfPresent(String.self, forKey: .endpoint)
    agentBotId = try c.decodeIfPresent(String.self, forKey: .agentBotId)
    agentExclusive = try c.decodeIfPresent(Bool.self, forKey: .agentExclusive) ?? false
  }
}

/// `rpc_mcp_assignments_list` and `_all` item: one agent's use of one server.
public struct McpAssignment: Sendable, Hashable, Decodable {
  public let botId: String
  public let serverId: String
  public let allowAllTools: Bool
  public let allowedTools: [String]

  public init(botId: String, serverId: String, allowAllTools: Bool = true, allowedTools: [String] = []) {
    self.botId = botId
    self.serverId = serverId
    self.allowAllTools = allowAllTools
    self.allowedTools = allowedTools
  }
}
