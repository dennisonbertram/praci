import Foundation

/// `rpc_me` and `bootstrap.me`. Only the fields Home needs; the rest are ignored.
public struct Me: Sendable, Hashable, Decodable {
  public let userId: String
  public let email: String
  public let name: String
  public let spaceId: String
  public let needsModel: Bool
  public let hiddenPages: [String]
  public let hideAmounts: Bool
  public let ticketBoardEnabled: Bool?

  private enum CodingKeys: String, CodingKey {
    case userId, email, name, spaceId, needsModel, hiddenPages, hideAmounts, ticketBoardEnabled
  }

  public init(from decoder: Decoder) throws {
    let c = try decoder.container(keyedBy: CodingKeys.self)
    userId = try c.decode(String.self, forKey: .userId)
    email = try c.decodeIfPresent(String.self, forKey: .email) ?? ""
    name = try c.decodeIfPresent(String.self, forKey: .name) ?? ""
    spaceId = try c.decode(String.self, forKey: .spaceId)
    needsModel = try c.decodeIfPresent(Bool.self, forKey: .needsModel) ?? false
    hiddenPages = try c.decodeIfPresent([String].self, forKey: .hiddenPages) ?? []
    hideAmounts = try c.decodeIfPresent(Bool.self, forKey: .hideAmounts) ?? false
    ticketBoardEnabled = try c.decodeIfPresent(Bool.self, forKey: .ticketBoardEnabled)
  }
}

/// A space as listed by `rpc_bootstrap` (`spaces`), `rpc_spaces_list` and returned by `rpc_spaces_create`.
public struct SpaceSummary: Sendable, Identifiable, Hashable, Decodable {
  public let id: String
  public let name: String
  public let isDefault: Bool
  public let canRename: Bool
  public let canDelete: Bool
  /// "remind", "confirm" or "off": what the space asks before recording a meeting.
  public let meetingRecording: String

  private enum CodingKeys: String, CodingKey {
    case id, name, isDefault, canRename, canDelete, meetingRecording
  }

  public init(from decoder: Decoder) throws {
    let c = try decoder.container(keyedBy: CodingKeys.self)
    id = try c.decode(String.self, forKey: .id)
    name = try c.decode(String.self, forKey: .name)
    isDefault = try c.decodeIfPresent(Bool.self, forKey: .isDefault) ?? false
    canRename = try c.decodeIfPresent(Bool.self, forKey: .canRename) ?? true
    canDelete = try c.decodeIfPresent(Bool.self, forKey: .canDelete) ?? false
    meetingRecording = try c.decodeIfPresent(String.self, forKey: .meetingRecording) ?? "remind"
  }
}

/// `rpc_bootstrap` output. The thread, routines and archived lists are ignored on Home.
public struct Bootstrap: Sendable, Decodable {
  public let me: Me
  public let bots: [BotSummary]
  public let groups: [GroupSummary]
  public let botSections: [BotSection]
  public let spaces: [SpaceSummary]

  private enum CodingKeys: String, CodingKey { case me, bots, groups, botSections, spaces }

  public init(from decoder: Decoder) throws {
    let c = try decoder.container(keyedBy: CodingKeys.self)
    me = try c.decode(Me.self, forKey: .me)
    bots = try c.decodeIfPresent([BotSummary].self, forKey: .bots) ?? []
    groups = try c.decodeIfPresent([GroupSummary].self, forKey: .groups) ?? []
    botSections = try c.decodeIfPresent([BotSection].self, forKey: .botSections) ?? []
    spaces = try c.decodeIfPresent([SpaceSummary].self, forKey: .spaces) ?? []
  }
}

/// `rpc_spaces_list` output.
public struct SpacesList: Sendable, Decodable {
  public let spaces: [SpaceSummary]
}

/// `rpc_inbox_unreadCount` output.
public struct UnreadCount: Sendable, Decodable {
  public let count: Int
}

/// `rpc_spaces_rename` output.
public struct RenamedSpace: Sendable, Decodable {
  public let id: String
  public let name: String
}

/// `rpc_spaces_remove` output: the space the server now treats as active.
public struct RemovedSpace: Sendable, Decodable {
  public let ok: Bool
  public let activeSpaceId: String
}

/// One Home row: an agent or a group.
public struct RosterRow: Sendable, Identifiable, Hashable {
  public enum Kind: Sendable, Hashable {
    case bot, group
  }

  public let kind: Kind
  public let id: String
  public let name: String
  public let preview: String
  public let unread: Bool
  public let pinned: Bool
  public let sectionId: String?
  public let updatedAt: String
  public let color: String?
  public let status: BotStatus
}

/// What Home shows for the agents: pinned rows, the main list, then named sections (decision J4).
public struct Roster: Sendable, Equatable {
  public struct Group: Sendable, Equatable {
    public let section: BotSection
    public let rows: [RosterRow]
  }

  public let pinned: [RosterRow]
  public let agents: [RosterRow]
  public let sections: [Group]

  public var isEmpty: Bool { pinned.isEmpty && agents.isEmpty && sections.allSatisfy { $0.rows.isEmpty } }

  public init(bots: [BotSummary], groups: [GroupSummary], sections: [BotSection]) {
    var rows = bots.filter { $0.hiddenAt == nil && $0.archivedAt == nil }.map {
      RosterRow(
        kind: .bot, id: $0.id, name: $0.name, preview: $0.preview, unread: $0.unread,
        pinned: $0.pinned, sectionId: $0.sectionId, updatedAt: $0.updatedAt, color: $0.color,
        status: $0.status)
    }
    rows += groups.filter { $0.archivedAt == nil }.map {
      RosterRow(
        kind: .group, id: $0.id, name: $0.name, preview: $0.preview, unread: $0.unread,
        pinned: $0.pinned, sectionId: $0.sectionId, updatedAt: $0.updatedAt, color: nil,
        status: .idle)
    }
    // Most recent first; ISO-8601 strings compare correctly. `sorted` is not stable, so break ties by id.
    rows.sort { ($0.updatedAt, $1.id) > ($1.updatedAt, $0.id) }
    let known = Set(sections.map(\.id))
    pinned = rows.filter(\.pinned)
    agents = rows.filter { !$0.pinned && ($0.sectionId.map { !known.contains($0) } ?? true) }
    self.sections = sections.sorted { $0.position < $1.position }.map { section in
      Group(section: section, rows: rows.filter { !$0.pinned && $0.sectionId == section.id })
    }
  }

  /// The collapsed AGENTS list: the four most recent rows plus every unread row; `hiddenCount` rows are behind "Show N more".
  public func visibleAgents(expanded: Bool) -> (rows: [RosterRow], hiddenCount: Int) {
    if expanded { return (agents, 0) }
    var seen = 0
    let rows = agents.filter { row in
      defer { seen += 1 }
      return seen < 4 || row.unread
    }
    return (rows, agents.count - rows.count)
  }
}
