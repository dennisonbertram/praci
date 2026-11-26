import Foundation

/// `rpc_models_list` item: one model in the provider catalog.
public struct ModelOption: Sendable, Hashable, Decodable, Identifiable {
  public let provider: String
  public let providerName: String
  public let id: String
  public let label: String
  public let auth: String
  public let oauthLabel: String?
  public let signIn: String?
  public let thinkingLevels: [String]
  public let placeholder: Bool

  public var key: String { "\(provider)/\(id)" }
  public var supportsSignIn: Bool { oauthLabel != nil && auth != "api-key" }
  public var supportsKey: Bool { auth != "oauth" }

  private enum CodingKeys: String, CodingKey {
    case provider, providerName, id, label, auth, oauthLabel, signIn, thinkingLevels, placeholder
  }

  public init(from decoder: Decoder) throws {
    let container = try decoder.container(keyedBy: CodingKeys.self)
    provider = try container.decode(String.self, forKey: .provider)
    providerName = try container.decodeIfPresent(String.self, forKey: .providerName) ?? provider
    id = try container.decode(String.self, forKey: .id)
    label = try container.decodeIfPresent(String.self, forKey: .label) ?? id
    auth = try container.decodeIfPresent(String.self, forKey: .auth) ?? "api-key"
    oauthLabel = try container.decodeIfPresent(String.self, forKey: .oauthLabel)
    signIn = try container.decodeIfPresent(String.self, forKey: .signIn)
    thinkingLevels = try container.decodeIfPresent([String].self, forKey: .thinkingLevels) ?? []
    placeholder = try container.decodeIfPresent(Bool.self, forKey: .placeholder) ?? false
  }
}

/// `rpc_models_credentials` item (also the output of `rpc_models_connect`): a connected provider.
public struct ModelCredential: Sendable, Hashable, Decodable, Identifiable {
  public let id: String
  public let provider: String
  public let label: String
  public let hasKey: Bool
  public let isDefault: Bool
  public let modelId: String?
  public let thinkingLevel: String?
  public let baseUrl: String?

  private enum CodingKeys: String, CodingKey {
    case id, provider, label, hasKey, isDefault, modelId, thinkingLevel, baseUrl
  }

  public init(from decoder: Decoder) throws {
    let container = try decoder.container(keyedBy: CodingKeys.self)
    id = try container.decode(String.self, forKey: .id)
    provider = try container.decode(String.self, forKey: .provider)
    label = try container.decodeIfPresent(String.self, forKey: .label) ?? provider
    hasKey = try container.decodeIfPresent(Bool.self, forKey: .hasKey) ?? false
    isDefault = try container.decodeIfPresent(Bool.self, forKey: .isDefault) ?? false
    modelId = try container.decodeIfPresent(String.self, forKey: .modelId)
    thinkingLevel = try container.decodeIfPresent(String.self, forKey: .thinkingLevel)
    baseUrl = try container.decodeIfPresent(String.self, forKey: .baseUrl)
  }
}

/// `rpc_models_beginOAuth` output. `userCode` is set for the device-code mode only.
public struct ModelOAuthBegin: Sendable, Decodable {
  public let loginId: String
  public let verificationUri: String
  public let expiresInSeconds: Int
  public let mode: String
  public let userCode: String?

  public var needsPastedCode: Bool { mode == "auth-url" }
}

/// `rpc_models_completeOAuth` output.
public struct ModelOAuthStatus: Sendable, Decodable {
  public let status: String
  public let error: String?
}

/// `{ ok: true }` outputs of the disconnect, revoke and remove procedures.
public struct OKResult: Sendable, Decodable {
  // The server names this key "ok".
  // swiftlint:disable:next identifier_name
  public let ok: Bool
}

/// `rpc_models_probeOpenAiCompatible` output.
public struct ProbedModels: Sendable, Decodable {
  public let models: [String]
}

/// `rpc_connections_catalog` item.
public struct ConnectorEntry: Sendable, Hashable, Decodable, Identifiable {
  public let connectorId: String
  public let slug: String
  public let name: String
  public let connected: Bool
  public let description: String?
  public let category: String

  public var id: String { "\(connectorId)/\(slug)" }

  private enum CodingKeys: String, CodingKey {
    case connectorId, slug, name, connected, description, category
  }

  public init(from decoder: Decoder) throws {
    let container = try decoder.container(keyedBy: CodingKeys.self)
    connectorId = try container.decode(String.self, forKey: .connectorId)
    slug = try container.decode(String.self, forKey: .slug)
    name = try container.decodeIfPresent(String.self, forKey: .name) ?? slug
    connected = try container.decodeIfPresent(Bool.self, forKey: .connected) ?? false
    description = try container.decodeIfPresent(String.self, forKey: .description)
    category = try container.decodeIfPresent(String.self, forKey: .category) ?? "other"
  }
}

/// `rpc_connections_list` item; also the output of `rpc_connections_complete` and `_setWrites`.
public struct Connection: Sendable, Hashable, Decodable, Identifiable {
  public let id: String
  public let connectorId: String
  public let provider: String
  public let displayName: String
  /// The account's own address (the mailbox), when known.
  public let account: String?
  public let status: String
  public let error: String?
  public let needsReconnect: Bool
  public let writesEnabled: Bool
  /// The connection's own agent, when it has one.
  public let agentBotId: String?

  public var isConnected: Bool { status == "connected" }
  public var isPending: Bool { status == "pending" }

  private enum CodingKeys: String, CodingKey {
    case id, connectorId, provider, displayName, account, status, error, needsReconnect
    case writesEnabled, agentBotId
  }

  public init(from decoder: Decoder) throws {
    let container = try decoder.container(keyedBy: CodingKeys.self)
    id = try container.decode(String.self, forKey: .id)
    connectorId = try container.decodeIfPresent(String.self, forKey: .connectorId) ?? ""
    provider = try container.decodeIfPresent(String.self, forKey: .provider) ?? ""
    displayName = try container.decodeIfPresent(String.self, forKey: .displayName) ?? provider
    account = try container.decodeIfPresent(String.self, forKey: .account)
    status = try container.decodeIfPresent(String.self, forKey: .status) ?? "error"
    error = try container.decodeIfPresent(String.self, forKey: .error)
    agentBotId = try container.decodeIfPresent(String.self, forKey: .agentBotId)
    needsReconnect = try container.decodeIfPresent(Bool.self, forKey: .needsReconnect) ?? false
    writesEnabled = try container.decodeIfPresent(Bool.self, forKey: .writesEnabled) ?? false
  }
}

/// `rpc_connections_begin` output. `authorizationUrl` is nil when no sign-in page is needed.
public struct ConnectionBegin: Sendable, Decodable {
  public let connectionId: String
  public let authorizationUrl: String?
}

/// `rpc_approvalRules_list` item; also the output of `rpc_approvalRules_set`.
public struct ApprovalRule: Sendable, Hashable, Decodable, Identifiable {
  public let id: String
  public let effect: String
  public let matchKind: String
  public let matchValue: String
  public let botId: String?

  private enum CodingKeys: String, CodingKey { case id, effect, matchKind, matchValue, botId }

  public init(from decoder: Decoder) throws {
    let container = try decoder.container(keyedBy: CodingKeys.self)
    id = try container.decode(String.self, forKey: .id)
    effect = try container.decodeIfPresent(String.self, forKey: .effect) ?? "require_approval"
    matchKind = try container.decodeIfPresent(String.self, forKey: .matchKind) ?? "tool"
    matchValue = try container.decodeIfPresent(String.self, forKey: .matchValue) ?? ""
    botId = try container.decodeIfPresent(String.self, forKey: .botId)
  }
}

/// `rpc_autoReview_get` and `_set` output.
public struct AutoReview: Sendable, Decodable {
  public let enabled: Bool
  public let checkerAvailable: Bool
}

/// One row of `rpc_autoReview_approvals`: a call approved without a card. `undoable` is false
/// when the tool has no undo path here.
public struct AutoApproval: Sendable, Decodable, Equatable, Identifiable {
  public let id: String
  public let tool: String
  public let botName: String
  /// What the call acted on, in plain words, when the log can name it.
  public let target: String?
  // swiftlint:disable:next identifier_name
  public let at: String
  public var undoable: Bool
  public var undone: Bool
}

/// `rpc_autoReview_approvals` output, the caller's automatic approvals newest first.
public struct AutoApprovalRows: Sendable, Decodable {
  public let rows: [AutoApproval]
}

/// `rpc_permissions_get` and `_set` output. `level` is nil while the space follows the default.
public struct PermissionSettings: Sendable, Decodable {
  public let level: String?
  public let effectiveDefault: String
  public var effective: String { level ?? effectiveDefault }
}

/// One provider in the catalog with its models, in the order the server lists them.
public struct ModelProvider: Sendable, Hashable, Identifiable {
  public let id: String
  public let name: String
  public let models: [ModelOption]

  public init(id: String, name: String, models: [ModelOption]) {
    self.id = id
    self.name = name
    self.models = models
  }

  public var supportsSignIn: Bool { models.first?.supportsSignIn ?? false }
  public var supportsKey: Bool { models.first?.supportsKey ?? true }
  public var signInLabel: String { models.first?.oauthLabel ?? name }
  /// Local servers are connected through their own form, not the provider list.
  public var isLocalServer: Bool { models.first?.placeholder ?? false }
}

extension [ModelOption] {
  public var providers: [ModelProvider] {
    var order: [String] = []
    var grouped: [String: [ModelOption]] = [:]
    for option in self {
      if grouped[option.provider] == nil { order.append(option.provider) }
      grouped[option.provider, default: []].append(option)
    }
    return order.map { id in
      let models = grouped[id] ?? []
      return ModelProvider(id: id, name: models.first?.providerName ?? id, models: models)
    }
  }
}

extension [ModelProvider] {
  /// The sign-in providers, most common subscription first, then the rest in catalog order.
  public var signInProviders: [ModelProvider] {
    let preferred = ["openai-codex", "anthropic", "github-copilot", "xai"]
    let all = filter(\.supportsSignIn)
    let lead = preferred.compactMap { id in all.first { $0.id == id } }
    return lead + all.filter { !preferred.contains($0.id) }
  }
}
