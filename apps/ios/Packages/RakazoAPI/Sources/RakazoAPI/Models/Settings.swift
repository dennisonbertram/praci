import Foundation

/// `rpc_notifications_preferences` and the result of `rpc_notifications_updatePreferences`.
public struct NotificationPreferences: Sendable, Hashable, Decodable {
  public var finish: Bool
  public var help: Bool
  public var takeover: Bool
  /// A channel the server omits is on.
  public var push: Bool
  public var imessage: Bool
  public let hasPhone: Bool
  public let hasImessage: Bool

  private enum CodingKeys: String, CodingKey {
    case finish, help, takeover, channels, hasPhone, hasImessage
  }

  private struct Channels: Decodable {
    let push: Bool?
    let imessage: Bool?
  }

  public init(from decoder: Decoder) throws {
    let container = try decoder.container(keyedBy: CodingKeys.self)
    finish = try container.decodeIfPresent(Bool.self, forKey: .finish) ?? true
    help = try container.decodeIfPresent(Bool.self, forKey: .help) ?? true
    takeover = try container.decodeIfPresent(Bool.self, forKey: .takeover) ?? true
    let channels = try container.decodeIfPresent(Channels.self, forKey: .channels)
    push = channels?.push ?? true
    imessage = channels?.imessage ?? true
    hasPhone = try container.decodeIfPresent(Bool.self, forKey: .hasPhone) ?? false
    hasImessage = try container.decodeIfPresent(Bool.self, forKey: .hasImessage) ?? false
  }
}

/// `rpc_notifications_updatePreferences` input; omitted fields stay as they are.
public struct NotificationPreferencesUpdate: Sendable, Encodable {
  public struct Channels: Sendable, Encodable {
    public var push: Bool?
    public var imessage: Bool?
    public init(push: Bool? = nil, imessage: Bool? = nil) {
      self.push = push
      self.imessage = imessage
    }
  }

  public var finish: Bool?
  public var help: Bool?
  public var takeover: Bool?
  public var channels: Channels?

  public init(
    finish: Bool? = nil, help: Bool? = nil, takeover: Bool? = nil, channels: Channels? = nil
  ) {
    self.finish = finish
    self.help = help
    self.takeover = takeover
    self.channels = channels
  }
}

/// `rpc_usage_summary`. Read only; counts can be null before the first run.
public struct UsageSummary: Sendable, Hashable, Decodable {
  public let inputTokens: Int?
  public let outputTokens: Int?
  public let totalTokens: Int?
  public let cacheReadTokens: Int?
  public let cacheWriteTokens: Int?
  public let modelCalls: Int?
  public let runs: Int

  private enum CodingKeys: String, CodingKey {
    case inputTokens, outputTokens, totalTokens, cacheReadTokens, cacheWriteTokens, modelCalls, runs
  }

  public init(from decoder: Decoder) throws {
    let container = try decoder.container(keyedBy: CodingKeys.self)
    inputTokens = try Self.count(container, .inputTokens)
    outputTokens = try Self.count(container, .outputTokens)
    totalTokens = try Self.count(container, .totalTokens)
    cacheReadTokens = try Self.count(container, .cacheReadTokens)
    cacheWriteTokens = try Self.count(container, .cacheWriteTokens)
    modelCalls = try Self.count(container, .modelCalls)
    runs = try Self.count(container, .runs) ?? 0
  }

  /// The server sends JSON numbers; tolerate a fractional value by rounding.
  private static func count(
    _ container: KeyedDecodingContainer<CodingKeys>, _ key: CodingKeys
  ) throws -> Int? {
    try container.decodeIfPresent(Double.self, forKey: key).map { Int($0.rounded()) }
  }
}

// `rpc_bots_restore` and `rpc_groups_restore` return `{ ok: true }`: see OKResult in Connections.swift.
