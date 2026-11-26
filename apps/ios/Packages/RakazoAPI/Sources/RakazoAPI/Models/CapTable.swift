import Foundation

public struct CapShareClass: Sendable, Hashable, Decodable, Identifiable {
  public let name: String
  public let shares: Int?
  public let percent: Double?
  public var id: String { name }
}

public struct CapHolder: Sendable, Hashable, Decodable, Identifiable {
  public let name: String
  public let email: String?
  public let organization: String?
  public let security: String?
  public let shares: Int?
  public let amountUsd: Double?
  public let percent: Double?
  public var id: String { [name, security ?? "", email ?? ""].joined(separator: "|") }
}

public struct Cap409A: Sendable, Hashable, Decodable {
  public let pricePerShareUsd: Double
  public let date: String
}

public struct CapSnapshot: Sendable, Hashable, Decodable {
  public let companyName: String
  public let asOf: String
  public let fullyDilutedShares: Int?
  public let source: String
  public let optionPoolAvailable: Int?
  public let latest409a: Cap409A?
  public let shareClasses: [CapShareClass]
  public let holders: [CapHolder]

  private enum CodingKeys: String, CodingKey {
    case companyName, asOf, fullyDilutedShares, source, optionPoolAvailable, latest409a
    case shareClasses, holders
  }

  public init(from decoder: Decoder) throws {
    let box = try decoder.container(keyedBy: CodingKeys.self)
    companyName = try box.decodeIfPresent(String.self, forKey: .companyName) ?? ""
    asOf = try box.decodeIfPresent(String.self, forKey: .asOf) ?? ""
    fullyDilutedShares = try box.decodeIfPresent(Int.self, forKey: .fullyDilutedShares)
    source = try box.decodeIfPresent(String.self, forKey: .source) ?? "carta"
    optionPoolAvailable = try box.decodeIfPresent(Int.self, forKey: .optionPoolAvailable)
    latest409a = try box.decodeIfPresent(Cap409A.self, forKey: .latest409a)
    shareClasses = try box.decodeIfPresent([CapShareClass].self, forKey: .shareClasses) ?? []
    holders = try box.decodeIfPresent([CapHolder].self, forKey: .holders) ?? []
  }
}

/// `rpc_investors_capTable` output. `snapshot` is null until Carta (or a sheet) has been read.
public struct CapTableResult: Sendable, Hashable, Decodable {
  public let snapshot: CapSnapshot?
  public let syncing: Bool
  public let lastReadFailed: Bool

  private enum CodingKeys: String, CodingKey { case snapshot, syncing, lastReadFailed }

  public init(from decoder: Decoder) throws {
    let box = try decoder.container(keyedBy: CodingKeys.self)
    snapshot = try box.decodeIfPresent(CapSnapshot.self, forKey: .snapshot)
    syncing = try box.decodeIfPresent(Bool.self, forKey: .syncing) ?? false
    lastReadFailed = try box.decodeIfPresent(Bool.self, forKey: .lastReadFailed) ?? false
  }
}

extension Array where Element == CapHolder {
  /// Holders with a percentage first, largest first; SAFEs and others without one keep server order after.
  public func sortedByOwnership() -> [CapHolder] {
    let owned = filter { $0.percent != nil }.sorted { ($0.percent ?? 0) > ($1.percent ?? 0) }
    return owned + filter { $0.percent == nil }
  }
}

/// "40%" or "11.5%".
public func capPercent(_ value: Double, locale: Locale = .current) -> String {
  (value / 100).formatted(.percent.precision(.fractionLength(0...1)).locale(locale))
}

public func capUSD(_ value: Double, fractionDigits: Int = 0, locale: Locale = .current) -> String {
  value.formatted(
    .currency(code: "USD").precision(.fractionLength(fractionDigits)).locale(locale))
}
