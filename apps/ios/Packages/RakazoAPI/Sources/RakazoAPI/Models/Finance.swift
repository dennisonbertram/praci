import Foundation

/// A connected finance source (`rpc_finance_overview` `sources`).
public struct FinanceSource: Sendable, Hashable, Decodable {
  public let provider: String
  public let status: String
  public let lastSyncedAt: String?

  private enum CodingKeys: String, CodingKey { case provider, status, lastSyncedAt }

  public init(from decoder: Decoder) throws {
    let container = try decoder.container(keyedBy: CodingKeys.self)
    provider = try container.decodeIfPresent(String.self, forKey: .provider) ?? ""
    status = try container.decodeIfPresent(String.self, forKey: .status) ?? "unknown"
    lastSyncedAt = try container.decodeIfPresent(String.self, forKey: .lastSyncedAt)
  }
}

/// One upcoming payment (`rpc_finance_overview` `upcoming.items`).
public struct FinanceUpcoming: Sendable, Hashable, Identifiable, Decodable {
  public let key: String
  public let name: String
  public let dates: [String]
  public let amountCents: Int
  public var id: String { key }

  private enum CodingKeys: String, CodingKey { case key, name, dates, amountCents }

  public init(from decoder: Decoder) throws {
    let container = try decoder.container(keyedBy: CodingKeys.self)
    key = try container.decode(String.self, forKey: .key)
    name = try container.decodeIfPresent(String.self, forKey: .name) ?? ""
    dates = try container.decodeIfPresent([String].self, forKey: .dates) ?? []
    amountCents = try container.decodeIfPresent(Int.self, forKey: .amountCents) ?? 0
  }
}

/// `rpc_finance_overview`. Cash, burn and runway are already totalled in USD by the server.
public struct FinanceOverview: Sendable, Decodable {
  public let sources: [FinanceSource]
  public let agentBotID: String?
  public let cashCents: Int
  public let hasCashAccounts: Bool
  public let monthlyBurnCents: Int
  public let runwayMonths: Double?
  public let upcoming: [FinanceUpcoming]
  public let subscriptions: [FinanceSubscription]
  public let subscriptionsTotalCents: Int
  public let excludedNonUsdCount: Int
  public let lastSyncedAt: String?

  private enum CodingKeys: String, CodingKey {
    case sources, agent, cash, hasCashAccounts, burn, runway, upcoming, subscriptions
    case excludedNonUsdCount, lastSyncedAt
  }
  private enum AgentKeys: String, CodingKey { case botId }
  private enum CashKeys: String, CodingKey { case cashCents }
  private enum BurnKeys: String, CodingKey { case monthlyCents }
  private enum RunwayKeys: String, CodingKey { case months }
  private enum UpcomingKeys: String, CodingKey { case items }
  private enum SubscriptionKeys: String, CodingKey { case items, totalMonthlyCents }

  public init(from decoder: Decoder) throws {
    let container = try decoder.container(keyedBy: CodingKeys.self)
    sources = try container.decodeIfPresent([FinanceSource].self, forKey: .sources) ?? []
    agentBotID = try? container.nestedContainer(keyedBy: AgentKeys.self, forKey: .agent)
      .decodeIfPresent(String.self, forKey: .botId)
    cashCents = try container.nestedContainer(keyedBy: CashKeys.self, forKey: .cash)
      .decodeIfPresent(Int.self, forKey: .cashCents) ?? 0
    hasCashAccounts = try container.decodeIfPresent(Bool.self, forKey: .hasCashAccounts) ?? false
    monthlyBurnCents = try container.nestedContainer(keyedBy: BurnKeys.self, forKey: .burn)
      .decodeIfPresent(Int.self, forKey: .monthlyCents) ?? 0
    runwayMonths = try? container.nestedContainer(keyedBy: RunwayKeys.self, forKey: .runway)
      .decodeIfPresent(Double.self, forKey: .months)
    upcoming = (try? container.nestedContainer(keyedBy: UpcomingKeys.self, forKey: .upcoming)
      .decodeIfPresent([FinanceUpcoming].self, forKey: .items)) ?? []
    let subs = try? container.nestedContainer(keyedBy: SubscriptionKeys.self, forKey: .subscriptions)
    subscriptions = (try? subs?.decodeIfPresent([FinanceSubscription].self, forKey: .items)) ?? []
    subscriptionsTotalCents =
      (try? subs?.decodeIfPresent(Int.self, forKey: .totalMonthlyCents)) ?? 0
    excludedNonUsdCount = try container.decodeIfPresent(Int.self, forKey: .excludedNonUsdCount) ?? 0
    lastSyncedAt = try container.decodeIfPresent(String.self, forKey: .lastSyncedAt)
  }

  /// A connected source exists (even when it holds no accounts yet).
  public var isConnected: Bool { sources.contains { $0.status != "not_connected" } }
}

/// One subscription (`rpc_finance_overview` `subscriptions.items`).
public struct FinanceSubscription: Sendable, Hashable, Identifiable, Decodable {
  public let key: String
  public let name: String
  public let monthlyCents: Int
  public let trendCents: [Int]
  public let lastChargeAt: String
  public let overlapGroup: String?

  private enum CodingKeys: String, CodingKey {
    case key, name, monthlyCents, trendCents, lastChargeAt, overlapGroup
  }

  public var id: String { key }

  public init(from decoder: Decoder) throws {
    let container = try decoder.container(keyedBy: CodingKeys.self)
    key = container.decodeLossyString(.key) ?? UUID().uuidString
    name = container.decodeLossyString(.name) ?? key
    monthlyCents = (try? container.decodeIfPresent(Int.self, forKey: .monthlyCents)) ?? 0
    trendCents = (try? container.decode([Int].self, forKey: .trendCents)) ?? []
    lastChargeAt = container.decodeLossyString(.lastChargeAt) ?? ""
    overlapGroup = try? container.decodeIfPresent(String.self, forKey: .overlapGroup)
  }
}

/// One account (`rpc_finance_accounts` `cash` / `cards`).
public struct FinanceAccount: Sendable, Hashable, Identifiable, Decodable {
  public let id: String
  public let provider: String
  public let name: String
  public let lastFour: String?
  public let kind: String
  public let balanceCents: Int
  public let currency: String

  private enum CodingKeys: String, CodingKey {
    case id, provider, name, lastFour, kind, balanceCents, currency
  }

  public init(from decoder: Decoder) throws {
    let container = try decoder.container(keyedBy: CodingKeys.self)
    id = try container.decode(String.self, forKey: .id)
    provider = try container.decodeIfPresent(String.self, forKey: .provider) ?? ""
    name = try container.decodeIfPresent(String.self, forKey: .name) ?? ""
    lastFour = try container.decodeIfPresent(String.self, forKey: .lastFour)
    kind = try container.decodeIfPresent(String.self, forKey: .kind) ?? ""
    balanceCents = try container.decodeIfPresent(Int.self, forKey: .balanceCents) ?? 0
    currency = try container.decodeIfPresent(String.self, forKey: .currency) ?? "USD"
  }
}

/// `rpc_finance_accounts`.
public struct FinanceAccounts: Sendable, Decodable {
  public let totalCashCents: Int
  public let cash: [FinanceAccount]
  public let cards: [FinanceAccount]

  private enum CodingKeys: String, CodingKey { case totalCashCents, cash, cards }

  public init(from decoder: Decoder) throws {
    let container = try decoder.container(keyedBy: CodingKeys.self)
    totalCashCents = try container.decodeIfPresent(Int.self, forKey: .totalCashCents) ?? 0
    cash = try container.decodeIfPresent([FinanceAccount].self, forKey: .cash) ?? []
    cards = try container.decodeIfPresent([FinanceAccount].self, forKey: .cards) ?? []
  }
}

/// One month of outflow (`rpc_finance_burn` `series`).
public struct FinanceBurnMonth: Sendable, Hashable, Identifiable, Decodable {
  public let month: String
  public let outCents: Int
  public let partial: Bool
  public var id: String { month }

  private enum CodingKeys: String, CodingKey { case month, outCents, partial }

  public init(from decoder: Decoder) throws {
    let container = try decoder.container(keyedBy: CodingKeys.self)
    month = try container.decode(String.self, forKey: .month)
    outCents = try container.decodeIfPresent(Int.self, forKey: .outCents) ?? 0
    partial = try container.decodeIfPresent(Bool.self, forKey: .partial) ?? false
  }
}

/// `rpc_finance_burn`.
public struct FinanceBurn: Sendable, Decodable {
  public let monthlyCents: Int
  public let series: [FinanceBurnMonth]

  private enum CodingKeys: String, CodingKey { case monthlyCents, series }

  public init(from decoder: Decoder) throws {
    let container = try decoder.container(keyedBy: CodingKeys.self)
    monthlyCents = try container.decodeIfPresent(Int.self, forKey: .monthlyCents) ?? 0
    series = try container.decodeIfPresent([FinanceBurnMonth].self, forKey: .series) ?? []
  }
}

/// A spend category (`rpc_finance_spend` `categories`).
public struct FinanceCategory: Sendable, Hashable, Identifiable, Decodable {
  public let key: String
  public let label: String
  public let cents: Int
  public var id: String { key }

  private enum CodingKeys: String, CodingKey { case key, label, cents }

  public init(from decoder: Decoder) throws {
    let container = try decoder.container(keyedBy: CodingKeys.self)
    key = try container.decode(String.self, forKey: .key)
    label = try container.decodeIfPresent(String.self, forKey: .label) ?? key
    cents = try container.decodeIfPresent(Int.self, forKey: .cents) ?? 0
  }
}

/// A transaction (`rpc_finance_spend` `transactions`, `rpc_finance_transaction` `transaction`).
public struct FinanceTransaction: Sendable, Hashable, Identifiable, Decodable {
  public let id: String
  public let provider: String
  public let postedAt: String
  public let amountCents: Int
  public let currency: String
  public let counterparty: String
  public let category: String?
  public let status: String
  public let classification: String
  public let cardLastFour: String?
  public let cardholder: String?
  public let memo: String?
  public let hasReceipt: Bool

  private enum CodingKeys: String, CodingKey {
    case id, provider, postedAt, amountCents, currency, counterparty, category, status
    case classification, cardLastFour, cardholder, memo, hasReceipt
  }

  public init(from decoder: Decoder) throws {
    let container = try decoder.container(keyedBy: CodingKeys.self)
    id = try container.decode(String.self, forKey: .id)
    provider = try container.decodeIfPresent(String.self, forKey: .provider) ?? ""
    postedAt = try container.decodeIfPresent(String.self, forKey: .postedAt) ?? ""
    amountCents = try container.decodeIfPresent(Int.self, forKey: .amountCents) ?? 0
    currency = try container.decodeIfPresent(String.self, forKey: .currency) ?? "USD"
    counterparty = try container.decodeIfPresent(String.self, forKey: .counterparty) ?? ""
    category = try container.decodeIfPresent(String.self, forKey: .category)
    status = try container.decodeIfPresent(String.self, forKey: .status) ?? "other"
    classification = try container.decodeIfPresent(String.self, forKey: .classification) ?? "spend"
    cardLastFour = try container.decodeIfPresent(String.self, forKey: .cardLastFour)
    cardholder = try container.decodeIfPresent(String.self, forKey: .cardholder)
    memo = try container.decodeIfPresent(String.self, forKey: .memo)
    hasReceipt = try container.decodeIfPresent(Bool.self, forKey: .hasReceipt) ?? false
  }
}

/// `rpc_finance_spend`.
public struct FinanceSpend: Sendable, Decodable {
  public let period: String
  public let totalCents: Int
  public let categories: [FinanceCategory]
  public let transactions: [FinanceTransaction]

  private enum CodingKeys: String, CodingKey { case period, totalCents, categories, transactions }

  public init(from decoder: Decoder) throws {
    let container = try decoder.container(keyedBy: CodingKeys.self)
    period = try container.decodeIfPresent(String.self, forKey: .period) ?? "month"
    totalCents = try container.decodeIfPresent(Int.self, forKey: .totalCents) ?? 0
    categories = try container.decodeIfPresent([FinanceCategory].self, forKey: .categories) ?? []
    transactions = try container.decodeIfPresent([FinanceTransaction].self, forKey: .transactions) ?? []
  }
}

/// `rpc_finance_transaction`.
public struct FinanceTransactionDetail: Sendable, Decodable {
  public let transaction: FinanceTransaction
  public let vendorName: String?
  public let account: FinanceAccount?
  public let vendorIsSubscription: Bool

  private enum CodingKeys: String, CodingKey {
    case transaction, vendorName, account, vendorIsSubscription
  }

  public init(from decoder: Decoder) throws {
    let container = try decoder.container(keyedBy: CodingKeys.self)
    transaction = try container.decode(FinanceTransaction.self, forKey: .transaction)
    vendorName = try container.decodeIfPresent(String.self, forKey: .vendorName)
    account = try container.decodeIfPresent(FinanceAccount.self, forKey: .account)
    vendorIsSubscription = try container.decodeIfPresent(Bool.self, forKey: .vendorIsSubscription) ?? false
  }
}
