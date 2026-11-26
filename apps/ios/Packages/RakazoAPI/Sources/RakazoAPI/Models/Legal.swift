import Foundation

/// A calendar day as the server sends it (`YYYY-MM-DD`). No time zone is involved in the maths.
public enum LegalDay {
  public static let dueSoonDays = 7

  private static var calendar: Calendar {
    var calendar = Calendar(identifier: .gregorian)
    calendar.timeZone = TimeZone(identifier: "UTC") ?? .gmt
    return calendar
  }

  public static func date(_ iso: String) -> Date? {
    let parts = iso.prefix(10).split(separator: "-").compactMap { Int($0) }
    guard parts.count == 3 else { return nil }
    return calendar.date(from: DateComponents(year: parts[0], month: parts[1], day: parts[2]))
  }

  /// The viewer's calendar date as `YYYY-MM-DD`.
  public static func today(_ now: Date = Date(), timeZone: TimeZone = .current) -> String {
    var local = Calendar(identifier: .gregorian)
    local.timeZone = timeZone
    let parts = local.dateComponents([.year, .month, .day], from: now)
    return String(format: "%04d-%02d-%02d", parts.year ?? 1970, parts.month ?? 1, parts.day ?? 1)
  }

  /// Whole days from `from` to `to`; negative when `to` is earlier.
  public static func days(from: String, to end: String) -> Int? {
    guard let first = date(from), let last = date(end) else { return nil }
    return calendar.dateComponents([.day], from: first, to: last).day
  }

  /// Overdue, or due within `dueSoonDays` days. The same rule as the web badge.
  public static func isDueSoon(_ due: String, today: String) -> Bool {
    (days(from: today, to: due) ?? Int.max) <= dueSoonDays
  }

  /// "Nov 8, 2026", in the given locale.
  public static func display(_ iso: String, locale: Locale = .current) -> String {
    guard let date = date(iso) else { return iso }
    var style = Date.FormatStyle(date: .abbreviated, time: .omitted, locale: locale)
    style.timeZone = TimeZone(identifier: "UTC") ?? .gmt
    return date.formatted(style)
  }
}

/// A value from decimal-string minor units ("1234567" is 12,345.67). Never goes through Double.
public func legalMoney(cents: String, currency: String?, locale: Locale = .current) -> String {
  guard var value = Decimal(string: cents) else { return cents }
  value /= 100
  guard let currency, !currency.isEmpty else { return value.formatted(.number.locale(locale)) }
  return value.formatted(.currency(code: currency).locale(locale).precision(.fractionLength(0...2)))
}

/// `rpc_legal_overview` contract row.
public struct LegalContract: Sendable, Identifiable, Hashable, Decodable {
  public let id: String
  public let dataRoomItemId: String?
  public let title: String
  public let contractType: String
  public let counterparties: [String]
  public let status: String
  public let effectiveDate: String?
  public let expirationDate: String?
  public let autoRenews: Bool
  public let renewalNoticeDays: Int?
  public let governingLaw: String?
  public let valueCents: String?
  public let currency: String?
  public let summary: String?
  public let nextDeadline: String?

  private enum CodingKeys: String, CodingKey {
    case id, dataRoomItemId, title, contractType, counterparties, status, effectiveDate
    case expirationDate, autoRenews, renewalNoticeDays, governingLaw, valueCents, currency
    case summary, nextDeadline
  }

  public init(from decoder: Decoder) throws {
    let box = try decoder.container(keyedBy: CodingKeys.self)
    id = try box.decode(String.self, forKey: .id)
    dataRoomItemId = try box.decodeIfPresent(String.self, forKey: .dataRoomItemId)
    title = try box.decodeIfPresent(String.self, forKey: .title) ?? ""
    contractType = try box.decodeIfPresent(String.self, forKey: .contractType) ?? "Other"
    counterparties = try box.decodeIfPresent([String].self, forKey: .counterparties) ?? []
    status = try box.decodeIfPresent(String.self, forKey: .status) ?? ""
    effectiveDate = try box.decodeIfPresent(String.self, forKey: .effectiveDate)
    expirationDate = try box.decodeIfPresent(String.self, forKey: .expirationDate)
    autoRenews = try box.decodeIfPresent(Bool.self, forKey: .autoRenews) ?? false
    renewalNoticeDays = try box.decodeIfPresent(Int.self, forKey: .renewalNoticeDays)
    governingLaw = try box.decodeIfPresent(String.self, forKey: .governingLaw)
    valueCents = try box.decodeIfPresent(String.self, forKey: .valueCents)
    currency = try box.decodeIfPresent(String.self, forKey: .currency)
    summary = try box.decodeIfPresent(String.self, forKey: .summary)
    nextDeadline = try box.decodeIfPresent(String.self, forKey: .nextDeadline)
  }
}

/// Contracts of one type, for a List section. Types sort by name; contracts by next deadline then title.
public struct LegalContractGroup: Sendable, Identifiable, Hashable {
  public let type: String
  public let contracts: [LegalContract]
  public var id: String { type }
}

extension Array where Element == LegalContract {
  public func groupedByType() -> [LegalContractGroup] {
    Dictionary(grouping: self, by: \.contractType)
      .map { type, rows in
        LegalContractGroup(
          type: type,
          contracts: rows.sorted {
            ($0.nextDeadline ?? "9999", $0.title) < ($1.nextDeadline ?? "9999", $1.title)
          })
      }
      .sorted { $0.type.localizedCaseInsensitiveCompare($1.type) == .orderedAscending }
  }
}

/// `rpc_legal_overview` deadline, `rpc_legal_updateDeadline` and `rpc_legal_doneDeadlines` rows.
public struct LegalDeadline: Sendable, Identifiable, Hashable, Decodable {
  public let id: String
  public let contractId: String?
  public let contractTitle: String?
  public let title: String
  public let dueDate: String
  public let kind: String
  public let status: String
  public let sourceQuote: String?
  public let notes: String?
  public let removalProposed: Bool

  private enum CodingKeys: String, CodingKey {
    case id, contractId, contractTitle, title, dueDate, kind, status, sourceQuote, notes
    case removalProposed
  }

  public init(from decoder: Decoder) throws {
    let box = try decoder.container(keyedBy: CodingKeys.self)
    id = try box.decode(String.self, forKey: .id)
    contractId = try box.decodeIfPresent(String.self, forKey: .contractId)
    contractTitle = try box.decodeIfPresent(String.self, forKey: .contractTitle)
    title = try box.decodeIfPresent(String.self, forKey: .title) ?? ""
    dueDate = try box.decodeIfPresent(String.self, forKey: .dueDate) ?? ""
    kind = try box.decodeIfPresent(String.self, forKey: .kind) ?? "other"
    status = try box.decodeIfPresent(String.self, forKey: .status) ?? "open"
    sourceQuote = try box.decodeIfPresent(String.self, forKey: .sourceQuote)
    notes = try box.decodeIfPresent(String.self, forKey: .notes)
    removalProposed = try box.decodeIfPresent(Bool.self, forKey: .removalProposed) ?? false
  }
}

extension Array where Element == LegalDeadline {
  /// Earliest first, ties by title.
  public func sortedByDue() -> [LegalDeadline] {
    sorted { ($0.dueDate, $0.title) < ($1.dueDate, $1.title) }
  }
}

public struct LegalScanRun: Sendable, Hashable, Decodable {
  public let id: String
  public let status: String
  public let error: String?
}

public struct LegalAgentState: Sendable, Hashable, Decodable {
  public let botId: String
  public let lastScanAt: String?
  public let dailyScanActive: Bool
  public let lastScanRun: LegalScanRun?

  private enum CodingKeys: String, CodingKey { case botId, lastScanAt, dailyScanActive, lastScanRun }

  public init(from decoder: Decoder) throws {
    let box = try decoder.container(keyedBy: CodingKeys.self)
    botId = try box.decode(String.self, forKey: .botId)
    lastScanAt = try box.decodeIfPresent(String.self, forKey: .lastScanAt)
    dailyScanActive = try box.decodeIfPresent(Bool.self, forKey: .dailyScanActive) ?? false
    lastScanRun = try box.decodeIfPresent(LegalScanRun.self, forKey: .lastScanRun)
  }
}

public struct LegalCounts: Sendable, Hashable, Decodable {
  public let contracts: Int
  public let openDeadlines: Int
  public let doneDeadlines: Int
  public let unreviewedDocuments: Int

  private enum CodingKeys: String, CodingKey {
    case contracts, openDeadlines, doneDeadlines, unreviewedDocuments
  }

  public init(from decoder: Decoder) throws {
    let box = try decoder.container(keyedBy: CodingKeys.self)
    contracts = try box.decodeIfPresent(Int.self, forKey: .contracts) ?? 0
    openDeadlines = try box.decodeIfPresent(Int.self, forKey: .openDeadlines) ?? 0
    doneDeadlines = try box.decodeIfPresent(Int.self, forKey: .doneDeadlines) ?? 0
    unreviewedDocuments = try box.decodeIfPresent(Int.self, forKey: .unreviewedDocuments) ?? 0
  }
}

/// `rpc_legal_overview` output.
public struct LegalOverview: Sendable, Hashable, Decodable {
  public var contracts: [LegalContract]
  public var deadlines: [LegalDeadline]
  public let counts: LegalCounts
  public let agent: LegalAgentState

  private enum CodingKeys: String, CodingKey { case contracts, deadlines, counts, agent }

  public init(from decoder: Decoder) throws {
    let box = try decoder.container(keyedBy: CodingKeys.self)
    contracts = try box.decodeIfPresent([LegalContract].self, forKey: .contracts) ?? []
    deadlines = try box.decodeIfPresent([LegalDeadline].self, forKey: .deadlines) ?? []
    counts = try box.decode(LegalCounts.self, forKey: .counts)
    agent = try box.decode(LegalAgentState.self, forKey: .agent)
  }

  public var isScanRunning: Bool { agent.lastScanRun?.status == "running" }
}

public struct LegalConsentRecipient: Sendable, Hashable, Decodable {
  public let name: String
  public let detail: String
}

/// `rpc_legal_consent` and `rpc_legal_consentGrant` output.
public struct LegalConsent: Sendable, Hashable, Decodable {
  public let key: String
  public let version: String
  public let allowed: Bool
  public let disclosure: String
  public let recipients: [LegalConsentRecipient]
  public let spaceId: String?

  private enum CodingKeys: String, CodingKey {
    case key, version, allowed, disclosure, recipients, spaceId
  }

  public init(from decoder: Decoder) throws {
    let box = try decoder.container(keyedBy: CodingKeys.self)
    key = try box.decode(String.self, forKey: .key)
    version = try box.decode(String.self, forKey: .version)
    allowed = try box.decodeIfPresent(Bool.self, forKey: .allowed) ?? false
    disclosure = try box.decodeIfPresent(String.self, forKey: .disclosure) ?? ""
    recipients = try box.decodeIfPresent([LegalConsentRecipient].self, forKey: .recipients) ?? []
    spaceId = try box.decodeIfPresent(String.self, forKey: .spaceId)
  }

  /// No model is connected, so there is nobody to allow: the page shows the blocker instead.
  public var needsModel: Bool { !allowed && recipients.isEmpty }
}

/// `rpc_legal_scanNow` output.
public struct LegalScanStart: Sendable, Hashable, Decodable {
  public let runId: String
  public let botId: String
}
