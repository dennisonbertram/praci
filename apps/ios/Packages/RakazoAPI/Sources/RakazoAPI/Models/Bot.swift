import Foundation

/// A bot's run state. Values the app does not know decode to `.unknown`.
public enum BotStatus: Sendable, Hashable, Decodable {
  case idle
  case running
  case waitingInput
  case unknown(String)

  public init(from decoder: Decoder) throws {
    let raw = try decoder.singleValueContainer().decode(String.self)
    switch raw {
    case "idle": self = .idle
    case "running": self = .running
    case "waiting_input": self = .waitingInput
    default: self = .unknown(raw)
    }
  }
}

/// One agent as listed by `rpc_bootstrap` (`bots`) and `rpc_spaces_list`.
public struct BotSummary: Sendable, Identifiable, Hashable, Decodable {
  public let id: String
  public let name: String
  public let title: String?
  /// `#RRGGBB`.
  public let color: String?
  public let pinned: Bool
  public let sectionId: String?
  public let position: Int?
  public let unread: Bool
  public let parentBotId: String?
  public let hiddenAt: String?
  public let archivedAt: String?
  public let threadId: String?
  public let preview: String
  public let status: BotStatus
  public let updatedAt: String

  private enum CodingKeys: String, CodingKey {
    case id, name, title, color, pinned, sectionId, position, unread, parentBotId
    case hiddenAt, archivedAt, threadId, preview, status, updatedAt
  }

  public init(from decoder: Decoder) throws {
    let c = try decoder.container(keyedBy: CodingKeys.self)
    id = try c.decode(String.self, forKey: .id)
    name = try c.decode(String.self, forKey: .name)
    title = try c.decodeIfPresent(String.self, forKey: .title)
    color = try c.decodeIfPresent(String.self, forKey: .color)
    pinned = try c.decodeIfPresent(Bool.self, forKey: .pinned) ?? false
    sectionId = try c.decodeIfPresent(String.self, forKey: .sectionId)
    position = try c.decodeIfPresent(Int.self, forKey: .position)
    unread = try c.decodeIfPresent(Bool.self, forKey: .unread) ?? false
    parentBotId = try c.decodeIfPresent(String.self, forKey: .parentBotId)
    hiddenAt = try c.decodeIfPresent(String.self, forKey: .hiddenAt)
    archivedAt = try c.decodeIfPresent(String.self, forKey: .archivedAt)
    threadId = try c.decodeIfPresent(String.self, forKey: .threadId)
    preview = try c.decodeIfPresent(String.self, forKey: .preview) ?? ""
    status = try c.decodeIfPresent(BotStatus.self, forKey: .status) ?? .idle
    updatedAt = try c.decodeIfPresent(String.self, forKey: .updatedAt) ?? ""
  }
}

public struct GroupMember: Sendable, Hashable, Decodable {
  public let botId: String
  public let name: String
  public let color: String?
  public let status: BotStatus?
}

/// One group chat as listed by `rpc_bootstrap` (`groups`).
public struct GroupSummary: Sendable, Identifiable, Hashable, Decodable {
  public let id: String
  public let name: String
  public let pinned: Bool
  public let sectionId: String?
  public let position: Int?
  public let archivedAt: String?
  public let members: [GroupMember]
  public let threadId: String?
  public let preview: String
  public let unread: Bool
  public let updatedAt: String

  private enum CodingKeys: String, CodingKey {
    case id, name, pinned, sectionId, position, archivedAt, members, threadId, preview, unread
    case updatedAt
  }

  public init(from decoder: Decoder) throws {
    let c = try decoder.container(keyedBy: CodingKeys.self)
    id = try c.decode(String.self, forKey: .id)
    name = try c.decode(String.self, forKey: .name)
    pinned = try c.decodeIfPresent(Bool.self, forKey: .pinned) ?? false
    sectionId = try c.decodeIfPresent(String.self, forKey: .sectionId)
    position = try c.decodeIfPresent(Int.self, forKey: .position)
    archivedAt = try c.decodeIfPresent(String.self, forKey: .archivedAt)
    members = try c.decodeIfPresent([GroupMember].self, forKey: .members) ?? []
    threadId = try c.decodeIfPresent(String.self, forKey: .threadId)
    preview = try c.decodeIfPresent(String.self, forKey: .preview) ?? ""
    unread = try c.decodeIfPresent(Bool.self, forKey: .unread) ?? false
    updatedAt = try c.decodeIfPresent(String.self, forKey: .updatedAt) ?? ""
  }
}

/// A named Home section that agents can be moved into (`botSections`).
public struct BotSection: Sendable, Identifiable, Hashable, Decodable {
  public let id: String
  public let name: String
  public let position: Int
  public let collapsed: Bool

  private enum CodingKeys: String, CodingKey { case id, name, position, collapsed }

  public init(from decoder: Decoder) throws {
    let c = try decoder.container(keyedBy: CodingKeys.self)
    id = try c.decode(String.self, forKey: .id)
    name = try c.decode(String.self, forKey: .name)
    position = try c.decodeIfPresent(Int.self, forKey: .position) ?? 0
    collapsed = try c.decodeIfPresent(Bool.self, forKey: .collapsed) ?? false
  }
}
