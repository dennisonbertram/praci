import Foundation

/// The server status for `rpc_investors_updates_list` and `rpc_investors_updates_get`.
public enum InvestorUpdateStatus: Sendable, Equatable, Decodable {
  case draft, sending, sent, partlySent, posted
  case unknown(String)

  public init(from decoder: Decoder) throws {
    let value = try decoder.singleValueContainer().decode(String.self)
    switch value {
    case "draft": self = .draft
    case "sending": self = .sending
    case "sent": self = .sent
    case "partly_sent": self = .partlySent
    case "posted": self = .posted
    default: self = .unknown(value)
    }
  }

  public var displayName: String {
    switch self {
    case .draft: "Draft"
    case .sending: "Sending"
    case .sent: "Sent"
    case .partlySent: "Partly sent"
    case .posted: "Posted"
    case .unknown(let value): value
    }
  }
}

/// The result recorded for one update recipient.
public enum InvestorDeliveryState: Sendable, Equatable, Decodable {
  case sent, sending, failed, unknown
  case future(String)

  public init(from decoder: Decoder) throws {
    let value = try decoder.singleValueContainer().decode(String.self)
    switch value {
    case "sent": self = .sent
    case "sending": self = .sending
    case "failed": self = .failed
    case "unknown": self = .unknown
    default: self = .future(value)
    }
  }

  public var displayName: String {
    switch self {
    case .sent: "Sent"
    case .sending: "Sending"
    case .failed: "Failed"
    case .unknown: "Unknown — check Sent mail"
    case .future(let value): value
    }
  }
}

public enum InvestorAudience: String, Sendable, Equatable, Decodable {
  case investors
  case board

  public var displayName: String {
    switch self {
    case .investors: "Investors"
    case .board: "Board"
    }
  }
}

public struct InvestorDelivery: Decodable, Sendable, Equatable, Identifiable {
  public let contactId: String
  public let name: String
  public let state: InvestorDeliveryState
  public var id: String { contactId }
}

/// `rpc_investors_updates_list` and `rpc_investors_updates_get`.
public struct InvestorUpdate: Decodable, Sendable, Equatable, Identifiable {
  public let id: String
  public let audience: InvestorAudience
  public let subject: String
  public let period: String
  public let body: String
  public let status: InvestorUpdateStatus
  public let recipientContactIds: [String]
  public let fromConnectionId: String?
  public let deliveries: [InvestorDelivery]
  public let sentAt: String?
  public let createdAt: String
  public let updatedAt: String
}

public enum AuditRequestStatus: String, Sendable, Equatable, Decodable {
  case open, drafted, done, dismissed

  public var displayName: String {
    switch self {
    case .open: "New"
    case .drafted: "Draft ready"
    case .done: "Done"
    case .dismissed: "Dismissed"
    }
  }
}

/// `rpc_investors_audits_list`.
public struct AuditRequest: Decodable, Sendable, Equatable, Identifiable {
  public let id: String
  public let fund: String
  public let asOf: String?
  public let asOfMatched: Bool
  public let dueDate: String?
  public let status: AuditRequestStatus
  public let mailThreadId: String?
  public let connectionId: String?
  public let draftRef: String?
  public let senderKnown: Bool
  public let notes: String
  public let dataRoomItemId: String?
  public let drafting: Bool
  public let newMail: Bool
  public let createdAt: String
}

/// The web update list's problem line for partly sent updates.
public func investorDeliveryProblemSummary(_ deliveries: [InvestorDelivery]) -> String {
  let failed = deliveries.filter { $0.state == .failed }
  let unknown = deliveries.filter { $0.state == .unknown }
  var parts: [String] = []
  if failed.count == 1, let recipient = failed.first {
    parts.append("\(recipient.name) failed")
  } else if failed.count > 1 {
    parts.append("\(failed.count) failed")
  }
  if unknown.count == 1, let recipient = unknown.first {
    parts.append("\(recipient.name): delivery unknown")
  } else if unknown.count > 1 {
    parts.append("\(unknown.count) deliveries unknown")
  }
  return parts.joined(separator: " · ")
}

/// Retry only recipients the server recorded as failed. Unknown delivery is never resent implicitly.
public func retryableInvestorContactIDs(_ deliveries: [InvestorDelivery]) -> [String] {
  deliveries.filter { $0.state == .failed }.map(\.contactId)
}
