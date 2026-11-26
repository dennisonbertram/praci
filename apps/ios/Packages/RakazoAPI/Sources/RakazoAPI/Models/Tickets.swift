import Foundation

/// Status values accepted by `rpc_tickets_list` and `rpc_tickets_move`.
public enum TicketStatus: Decodable, Sendable, Hashable {
  case todo, doing, review, blocked, done, closed
  case unknown(String)

  public static let allCases: [TicketStatus] = [.todo, .doing, .review, .blocked, .done, .closed]

  public init(from decoder: Decoder) throws {
    let raw = try decoder.singleValueContainer().decode(String.self)
    switch raw {
    case "todo": self = .todo
    case "doing": self = .doing
    case "review": self = .review
    case "blocked": self = .blocked
    case "done": self = .done
    case "closed": self = .closed
    default: self = .unknown(raw)
    }
  }

  public var label: String {
    switch self {
    case .todo: "To do"
    case .doing: "In progress"
    case .review: "In review"
    case .blocked: "Blocked"
    case .done: "Done"
    case .closed: "Won't do"
    case .unknown(let value): value
    }
  }

  public var rawValue: String {
    switch self {
    case .todo: "todo"
    case .doing: "doing"
    case .review: "review"
    case .blocked: "blocked"
    case .done: "done"
    case .closed: "closed"
    case .unknown(let value): value
    }
  }
}

public enum TicketPriority: Decodable, Sendable, Hashable {
  case low, normal, high, urgent
  case unknown(String)

  public init(from decoder: Decoder) throws {
    let raw = try decoder.singleValueContainer().decode(String.self)
    switch raw {
    case "low": self = .low
    case "normal": self = .normal
    case "high": self = .high
    case "urgent": self = .urgent
    default: self = .unknown(raw)
    }
  }

  public var label: String {
    switch self {
    case .low: "Low"
    case .normal: "Normal"
    case .high: "High"
    case .urgent: "Urgent"
    case .unknown(let value): value
    }
  }
}

/// A ticket returned by `rpc_tickets_list`.
public struct Ticket: Sendable, Identifiable, Hashable, Decodable {
  public let id: String
  public let boardId: String
  public let spaceId: String
  public let number: Int
  public let ref: String
  public let title: String
  public let description: String?
  public let status: TicketStatus
  public let priority: TicketPriority
  public let assigneeBotId: String?
  public let createdByBotId: String?
  public let createdByUserId: String?
  public let createdAt: String
  public let updatedAt: String
  public let completedAt: String?
}

/// A comment returned by `rpc_tickets_comments` and `rpc_tickets_comment`.
public struct TicketComment: Sendable, Identifiable, Hashable, Decodable {
  public let id: String
  public let ticketId: String
  public let body: String
  public let authorBotId: String?
  public let authorUserId: String?
  public let authorName: String?
  public let createdAt: String
  public let updatedAt: String
}

public struct TicketList: Sendable, Decodable {
  public let tickets: [Ticket]
}

/// Groups rows in the column order used by the web board, including empty columns.
public struct TicketStatusGroup: Sendable, Identifiable {
  public let status: TicketStatus
  public let tickets: [Ticket]

  public var id: TicketStatus { status }
}

public func groupTicketsByStatus(_ tickets: [Ticket]) -> [TicketStatusGroup] {
  TicketStatus.allCases.map { status in
    TicketStatusGroup(status: status, tickets: tickets.filter { $0.status == status })
  }
}
