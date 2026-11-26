import Foundation

/// `rpc_brexCards_overview`: owner-only Brex summary. Amounts are integer cents.
public struct BrexCardsOverview: Decodable, Sendable {
  public let serverId: String
  public let agentBotId: String?
  public let writesEnabled: Bool
  public let partial: Bool
  public let cash: BrexCash
  public let cardSpend: BrexCardSpend
  public let cards: BrexCardCounts
  public let nearLimit: BrexNearLimit
}

public struct BrexCash: Decodable, Sendable {
  public let totalCents: Int
  public let availableCents: Int
  public let accountCount: Int
}

public struct BrexCardSpend: Decodable, Sendable {
  public let partial: Bool
  public let monthToDateCents: Int
  public let previousMonthToDateCents: Int
  public let changePercent: Double?
}

public struct BrexCardCounts: Decodable, Sendable {
  public let active: Int
  public let locked: Int
  public let terminated: Int
}

public struct BrexNearLimit: Decodable, Sendable {
  public let partial: Bool
  public let count: Int
  public let items: [BrexNearLimitItem]
}

public struct BrexNearLimitItem: Decodable, Sendable, Identifiable {
  public let kind: String
  public let id: String
  public let name: String
  public let usedCents: Int
  public let limitCents: Int
  public let percent: Double
}

/// `rpc_brexCards_cardsView`: the cards read model used by the Brex page.
public struct BrexCardsView: Decodable, Sendable {
  public let serverId: String
  public let agentBotId: String?
  public let writesEnabled: Bool
  public let partial: Bool
  public let cards: [BrexCardView]
}

public struct BrexCardView: Decodable, Sendable, Identifiable {
  public let cardId: String
  public let name: String
  public let lastFour: String
  public let ownerUserId: String?
  public let status: String
  public let limitCents: Int?
  public let currency: String?
  public let duration: String?
  public let cardType: String?
  public let lockAfterDate: String?
  public let allowedMerchants: [String]
  public let blockedMerchants: [String]
  public let ownerName: String?
  public let period: BrexCardPeriod
  public let periodSpendCents: Int
  public let usage: BrexCardUsage?
  public let partial: Bool

  public var id: String { cardId }
}

public struct BrexCardPeriod: Decodable, Sendable {
  public let start: String
  public let end: String
}

public struct BrexCardUsage: Decodable, Sendable {
  public let usedCents: Int
  public let limitCents: Int
  public let percent: Double
}

/// `rpc_brexCards_limits`.
public struct BrexLimits: Decodable, Sendable {
  public let serverId: String
  public let agentBotId: String?
  public let writesEnabled: Bool
  public let partial: Bool
  public let limits: [BrexSpendLimit]
}

public struct BrexSpendLimit: Decodable, Sendable, Identifiable {
  public let spendLimitId: String
  public let name: String
  public let status: String?
  public let period: String?
  public let startDate: String?
  public let endDate: String?
  public let limitCents: Int?
  public let currency: String?
  public let usedCents: Int?
  public let percent: Double?
  public var id: String { spendLimitId }
}

/// `rpc_brexCards_activity`: recent actions performed through the Brex agent.
public struct BrexActivity: Decodable, Sendable {
  public let serverId: String
  public let agentBotId: String?
  public let writesEnabled: Bool
  public let activities: [BrexActivityItem]
}

public struct BrexActivityItem: Decodable, Sendable, Identifiable {
  public let effectId: String
  public let at: String
  public let action: String
  public let target: String?
  public let status: String
  public var id: String { effectId }
}

/// Web prompt reasons; these values are inserted into the fixed `cancelMessage` template.
public enum BrexCancelReason: String, CaseIterable, Hashable, Sendable {
  case other = "OTHER"
  case cardDamaged = "CARD_DAMAGED"
  case cardLost = "CARD_LOST"
  case cardNotReceived = "CARD_NOT_RECEIVED"
  case doNotNeedPhysicalCard = "DO_NOT_NEED_PHYSICAL_CARD"
  case doNotNeedVirtualCard = "DO_NOT_NEED_VIRTUAL_CARD"
  case fraud = "FRAUD"
}

/// Brex IDs are provider-controlled text; only tokens accepted by the web action are usable.
public func brexLockMessage(cardId: String) -> String? {
  guard isUsableBrexCardID(cardId) else { return nil }
  return "Lock card \(cardId)."
}

public func brexCancelMessage(cardId: String, reason: BrexCancelReason) -> String? {
  guard isUsableBrexCardID(cardId) else { return nil }
  return "Cancel card \(cardId), reason \(reason.rawValue)."
}

public func isUsableBrexCardID(_ cardId: String) -> Bool {
  !cardId.isEmpty && cardId.utf8.count <= 200
    && cardId.utf8.allSatisfy { byte in
      (65...90).contains(byte) || (97...122).contains(byte) || (48...57).contains(byte)
        || byte == 95 || byte == 45
    }
}

/// Card statuses shown in the web cards list. Unknown provider codes have a stable fallback label.
public func brexCardStatusLabel(_ status: String) -> String {
  switch status.trimmingCharacters(in: .whitespacesAndNewlines).uppercased() {
  case "ACTIVE": "Active"
  case "LOCKED": "Locked"
  case "TERMINATED": "Terminated"
  default: "Unknown"
  }
}

/// Spend-limit status labels used by the web Brex page.
public func brexLimitStatusLabel(_ status: String?) -> String {
  guard let status, !status.isEmpty else { return "—" }
  return switch status.trimmingCharacters(in: .whitespacesAndNewlines).uppercased() {
  case "ACTIVE": "Active"
  case "ARCHIVED": "Archived"
  case "INACTIVE": "Inactive"
  case "INVITED": "Invited"
  case "LOCKED": "Locked"
  case "SUSPENDED": "Suspended"
  case "TERMINATED": "Terminated"
  default: status.replacingOccurrences(of: "_", with: " ").lowercased()
  }
}

public func brexActivityActionLabel(_ action: String) -> String {
  switch action {
  case "create_vendor_card": "New card"
  case "update_card": "Edit card"
  case "lock_card": "Lock card"
  case "terminate_card": "Cancel card"
  case "create_spend_limit": "New spend limit"
  case "update_spend_limit": "Update spend limit"
  case "update_expense_memo": "Edit memo"
  default: action.replacingOccurrences(of: "_", with: " ").lowercased()
  }
}

public func brexActivityResultLabel(_ status: String) -> String {
  switch status {
  case "succeeded": "Done"
  case "failed": "Failed"
  case "denied": "Declined"
  case "approved": "Approved"
  case "executing": "Running"
  case "intended": "Waiting"
  default: status.replacingOccurrences(of: "_", with: " ").lowercased()
  }
}

public func brexSpendPeriodLabel(_ period: String?) -> String {
  guard let period else { return "last 90 days" }
  return switch period.uppercased().replacingOccurrences(of: "PER_", with: "") {
  case "DAILY": "day"
  case "WEEKLY": "week"
  case "MONTHLY": "month"
  case "QUARTERLY": "quarter"
  case "YEARLY": "year"
  case "ONE_TIME": "one time"
  default: period.replacingOccurrences(of: "_", with: " ").lowercased()
  }
}

public func brexChangeLabel(_ percent: Double?) -> String {
  guard let percent else { return "No comparison" }
  let sign = percent > 0 ? "+" : percent < 0 ? "−" : ""
  return "\(sign)\(String(format: "%.1f", abs(percent)))% vs last month"
}
