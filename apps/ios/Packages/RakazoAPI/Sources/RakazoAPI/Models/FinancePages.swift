import Foundation

// MARK: - Shared shapes

/// A labelled money total the server has already grouped: a category, a vendor, an account.
public struct FinanceBreakdown: Sendable, Hashable, Identifiable, Decodable {
  public let key: String
  public let label: String
  public let cents: Int
  public var id: String { key }

  private enum CodingKeys: String, CodingKey { case key, label, cents }

  public init(key: String, label: String, cents: Int) {
    self.key = key
    self.label = label
    self.cents = cents
  }

  public init(from decoder: Decoder) throws {
    let container = try decoder.container(keyedBy: CodingKeys.self)
    key = container.decodeLossyString(.key) ?? UUID().uuidString
    label = container.decodeLossyString(.label) ?? key
    cents = (try? container.decodeIfPresent(Int.self, forKey: .cents)) ?? 0
  }
}

/// One month's balance, used by the runway and accounts charts.
public struct FinanceBalancePoint: Sendable, Hashable, Identifiable, Decodable {
  public let month: String
  public let balanceCents: Int
  public var id: String { month }

  private enum CodingKeys: String, CodingKey { case month, balanceCents }

  public init(month: String, balanceCents: Int) {
    self.month = month
    self.balanceCents = balanceCents
  }

  public init(from decoder: Decoder) throws {
    let container = try decoder.container(keyedBy: CodingKeys.self)
    month = container.decodeLossyString(.month) ?? ""
    balanceCents = (try? container.decodeIfPresent(Int.self, forKey: .balanceCents)) ?? 0
  }
}

/// One month's spend, used by a category's trend.
public struct FinanceMonthCents: Sendable, Hashable, Identifiable, Decodable {
  public let month: String
  public let cents: Int
  public var id: String { month }

  private enum CodingKeys: String, CodingKey { case month, cents }

  public init(from decoder: Decoder) throws {
    let container = try decoder.container(keyedBy: CodingKeys.self)
    month = container.decodeLossyString(.month) ?? ""
    cents = (try? container.decodeIfPresent(Int.self, forKey: .cents)) ?? 0
  }
}

/// The account or card a charge was paid with.
public struct FinancePaidWith: Sendable, Hashable, Decodable {
  public let provider: String
  public let kind: String
  public let name: String
  public let lastFour: String?

  private enum CodingKeys: String, CodingKey { case provider, kind, name, lastFour }

  public init(from decoder: Decoder) throws {
    let container = try decoder.container(keyedBy: CodingKeys.self)
    provider = container.decodeLossyString(.provider) ?? ""
    kind = container.decodeLossyString(.kind) ?? "account"
    name = container.decodeLossyString(.name) ?? ""
    lastFour = try? container.decodeIfPresent(String.self, forKey: .lastFour)
  }

  /// The account as one line. The last four are left out when the name already carries them.
  public var title: String {
    guard let lastFour, !name.contains(lastFour) else { return name }
    return "\(name) · \(lastFour)"
  }
}

// MARK: - Accounts

/// `rpc_finance_accounts`. Cash, cards and the reconstructed balance history.
public struct FinanceAccountsPage: Sendable, Decodable {
  public let totalCashCents: Int
  public let cardOwedCents: Int?
  public let history: [FinanceBalancePoint]
  public let cash: [FinanceAccount]
  public let cards: [FinanceAccount]

  private enum CodingKeys: String, CodingKey {
    case totalCashCents, cardOwedCents, history, cash, cards
  }

  public init(from decoder: Decoder) throws {
    let container = try decoder.container(keyedBy: CodingKeys.self)
    totalCashCents = (try? container.decodeIfPresent(Int.self, forKey: .totalCashCents)) ?? 0
    cardOwedCents = try? container.decodeIfPresent(Int.self, forKey: .cardOwedCents)
    history = (try? container.decode([FinanceBalancePoint].self, forKey: .history)) ?? []
    cash = (try? container.decode([FinanceAccount].self, forKey: .cash)) ?? []
    cards = (try? container.decode([FinanceAccount].self, forKey: .cards)) ?? []
  }

  public var isEmpty: Bool { cash.isEmpty && cards.isEmpty }
}

/// One month of treasury yield (`rpc_finance_account` `treasuryYield`).
public struct FinanceTreasuryYield: Sendable, Hashable, Identifiable, Decodable {
  public let month: String
  public let yieldCents: Int?
  public let annualYieldPct: Double?
  public var id: String { month }

  private enum CodingKeys: String, CodingKey { case month, yieldCents, annualYieldPct }

  public init(from decoder: Decoder) throws {
    let container = try decoder.container(keyedBy: CodingKeys.self)
    month = container.decodeLossyString(.month) ?? ""
    yieldCents = try? container.decodeIfPresent(Int.self, forKey: .yieldCents)
    annualYieldPct = try? container.decodeIfPresent(Double.self, forKey: .annualYieldPct)
  }
}

/// `rpc_finance_account`. One account, its balance history and its newest transactions.
public struct FinanceAccountPage: Sendable, Decodable {
  public let account: FinanceAccount
  public let history: [FinanceBalancePoint]
  public let treasuryYield: [FinanceTreasuryYield]
  public let transactions: [FinanceTransaction]

  private enum CodingKeys: String, CodingKey { case account, history, treasuryYield, transactions }

  public init(from decoder: Decoder) throws {
    let container = try decoder.container(keyedBy: CodingKeys.self)
    account = try container.decode(FinanceAccount.self, forKey: .account)
    history = (try? container.decode([FinanceBalancePoint].self, forKey: .history)) ?? []
    treasuryYield = (try? container.decode([FinanceTreasuryYield].self, forKey: .treasuryYield)) ?? []
    transactions = (try? container.decode([FinanceTransaction].self, forKey: .transactions)) ?? []
  }
}

// MARK: - Burn

/// `rpc_finance_burn`. The average burn, where it went, and which accounts paid.
public struct FinanceBurnPage: Sendable, Decodable {
  public let monthlyCents: Int
  public let series: [FinanceBurnMonth]
  public let windowMonths: [String]
  public let whereItWent: [FinanceBreakdown]
  public let byAccount: [FinanceBurnAccount]

  private enum CodingKeys: String, CodingKey {
    case monthlyCents, series, windowMonths, whereItWent, byAccount
  }

  public init(from decoder: Decoder) throws {
    let container = try decoder.container(keyedBy: CodingKeys.self)
    monthlyCents = (try? container.decodeIfPresent(Int.self, forKey: .monthlyCents)) ?? 0
    series = (try? container.decode([FinanceBurnMonth].self, forKey: .series)) ?? []
    windowMonths = (try? container.decode([String].self, forKey: .windowMonths)) ?? []
    whereItWent = (try? container.decode([FinanceBreakdown].self, forKey: .whereItWent)) ?? []
    byAccount = (try? container.decode([FinanceBurnAccount].self, forKey: .byAccount)) ?? []
  }

  /// The months the average covers, as one line, e.g. "Aug – Oct 2026".
  public var windowTitle: String? {
    guard let first = windowMonths.first, let last = windowMonths.last else { return nil }
    return "\(CompanyDateText.month(first)) – \(CompanyDateText.month(last))"
  }
}

/// One account's share of the burn window.
public struct FinanceBurnAccount: Sendable, Hashable, Identifiable, Decodable {
  public let account: FinanceAccount
  public let cents: Int
  public var id: String { account.id }

  private enum CodingKeys: String, CodingKey { case account, cents }

  public init(from decoder: Decoder) throws {
    let container = try decoder.container(keyedBy: CodingKeys.self)
    account = try container.decode(FinanceAccount.self, forKey: .account)
    cents = (try? container.decodeIfPresent(Int.self, forKey: .cents)) ?? 0
  }
}

// MARK: - Month

/// `rpc_finance_month`. One calendar month's money in and out, with its transactions.
public struct FinanceMonthPage: Sendable, Decodable {
  public let month: String
  public let partial: Bool
  public let outCents: Int
  public let inCents: Int
  public let netCents: Int
  public let categories: [FinanceBreakdown]
  public let transactions: [FinanceTransaction]

  private enum CodingKeys: String, CodingKey {
    case month, partial, outCents, inCents, netCents, categories, transactions
  }

  public init(from decoder: Decoder) throws {
    let container = try decoder.container(keyedBy: CodingKeys.self)
    month = container.decodeLossyString(.month) ?? ""
    partial = (try? container.decodeIfPresent(Bool.self, forKey: .partial)) ?? false
    outCents = (try? container.decodeIfPresent(Int.self, forKey: .outCents)) ?? 0
    inCents = (try? container.decodeIfPresent(Int.self, forKey: .inCents)) ?? 0
    netCents = (try? container.decodeIfPresent(Int.self, forKey: .netCents)) ?? 0
    categories = (try? container.decode([FinanceBreakdown].self, forKey: .categories)) ?? []
    transactions = (try? container.decode([FinanceTransaction].self, forKey: .transactions)) ?? []
  }
}

// MARK: - Runway

/// `rpc_finance_runway`. Cash, burn and how long the cash lasts under the saved crypto scope.
public struct FinanceRunwayPage: Sendable, Decodable {
  public let runwayCrypto: String
  public let cashCents: Int
  public let breakdown: FinanceRunwayBreakdown
  public let monthlyBurnCents: Int
  public let runwayMonths: Double?
  public let runOutDate: String?
  public let history: [FinanceBalancePoint]
  public let projection: [FinanceBalancePoint]

  private enum CodingKeys: String, CodingKey {
    case runwayCrypto, cashCents, breakdown, monthlyBurnCents, runway, history, projection
  }
  private enum RunwayKeys: String, CodingKey { case months, runOutDate }

  public init(from decoder: Decoder) throws {
    let container = try decoder.container(keyedBy: CodingKeys.self)
    runwayCrypto = container.decodeLossyString(.runwayCrypto) ?? "bank"
    cashCents = (try? container.decodeIfPresent(Int.self, forKey: .cashCents)) ?? 0
    breakdown = (try? container.decode(FinanceRunwayBreakdown.self, forKey: .breakdown))
      ?? FinanceRunwayBreakdown(bankCents: 0, stablecoinCents: 0, otherCryptoCents: 0, unpriced: 0)
    monthlyBurnCents = (try? container.decodeIfPresent(Int.self, forKey: .monthlyBurnCents)) ?? 0
    let runway = try? container.nestedContainer(keyedBy: RunwayKeys.self, forKey: .runway)
    runwayMonths = try? runway?.decodeIfPresent(Double.self, forKey: .months)
    runOutDate = try? runway?.decodeIfPresent(String.self, forKey: .runOutDate)
    history = (try? container.decode([FinanceBalancePoint].self, forKey: .history)) ?? []
    projection = (try? container.decode([FinanceBalancePoint].self, forKey: .projection)) ?? []
  }

  /// What counts as cash, as the page's scope picker shows it.
  public var scopeTitle: String {
    switch runwayCrypto {
    case "stablecoins": "Bank and stablecoins"
    case "all": "Bank and all crypto"
    default: "Bank only"
    }
  }
}

/// The parts of the runway figure, whether or not each one counts.
public struct FinanceRunwayBreakdown: Sendable, Hashable, Decodable {
  public let bankCents: Int
  public let stablecoinCents: Int
  public let otherCryptoCents: Int
  public let unpriced: Int

  private enum CodingKeys: String, CodingKey {
    case bankCents, stablecoinCents, otherCryptoCents, unpricedTokenCount
  }

  public init(bankCents: Int, stablecoinCents: Int, otherCryptoCents: Int, unpriced: Int) {
    self.bankCents = bankCents
    self.stablecoinCents = stablecoinCents
    self.otherCryptoCents = otherCryptoCents
    self.unpriced = unpriced
  }

  public init(from decoder: Decoder) throws {
    let container = try decoder.container(keyedBy: CodingKeys.self)
    bankCents = (try? container.decodeIfPresent(Int.self, forKey: .bankCents)) ?? 0
    stablecoinCents = (try? container.decodeIfPresent(Int.self, forKey: .stablecoinCents)) ?? 0
    otherCryptoCents = (try? container.decodeIfPresent(Int.self, forKey: .otherCryptoCents)) ?? 0
    unpriced = (try? container.decodeIfPresent(Int.self, forKey: .unpricedTokenCount)) ?? 0
  }
}

/// `rpc_finance_preferences`, the saved crypto scope.
public struct FinancePreferences: Sendable, Hashable, Decodable, Encodable {
  public let runwayCrypto: String

  private enum CodingKeys: String, CodingKey { case runwayCrypto }

  public init(runwayCrypto: String) {
    self.runwayCrypto = runwayCrypto
  }

  public init(from decoder: Decoder) throws {
    let container = try decoder.container(keyedBy: CodingKeys.self)
    runwayCrypto = container.decodeLossyString(.runwayCrypto) ?? "bank"
  }
}

// MARK: - Crypto

/// One token holding across every wallet.
public struct FinanceCryptoHolding: Sendable, Hashable, Identifiable, Decodable {
  public let walletId: String
  public let chainId: Int
  public let symbol: String
  public let name: String
  public let usdValueCents: Int?
  public var id: String { "\(walletId)-\(chainId)-\(symbol)" }

  private enum CodingKeys: String, CodingKey {
    case walletId, chainId, symbol, name, usdValueCents
  }

  public init(from decoder: Decoder) throws {
    let container = try decoder.container(keyedBy: CodingKeys.self)
    walletId = container.decodeLossyString(.walletId) ?? ""
    chainId = (try? container.decodeIfPresent(Int.self, forKey: .chainId)) ?? 1
    symbol = container.decodeLossyString(.symbol) ?? ""
    name = container.decodeLossyString(.name) ?? symbol
    usdValueCents = try? container.decodeIfPresent(Int.self, forKey: .usdValueCents)
  }
}

/// A wallet the user watches.
public struct FinanceWallet: Sendable, Hashable, Identifiable, Decodable {
  public let id: String
  public let address: String
  public let ensName: String?
  public let label: String?
  public let type: String
  public let safeThreshold: Int?

  private enum CodingKeys: String, CodingKey {
    case id, address, ensName, label, type, safeThreshold
  }

  public init(from decoder: Decoder) throws {
    let container = try decoder.container(keyedBy: CodingKeys.self)
    id = try container.decode(String.self, forKey: .id)
    address = container.decodeLossyString(.address) ?? ""
    ensName = try? container.decodeIfPresent(String.self, forKey: .ensName)
    label = try? container.decodeIfPresent(String.self, forKey: .label)
    type = container.decodeLossyString(.type) ?? "eoa"
    safeThreshold = try? container.decodeIfPresent(Int.self, forKey: .safeThreshold)
  }

  /// The name the list shows: the label, else the ENS name, else a shortened address.
  public var title: String {
    if let label, !label.isEmpty { return label }
    if let ensName, !ensName.isEmpty { return ensName }
    return shortAddress
  }

  public var shortAddress: String {
    address.count > 12 ? "\(address.prefix(6))…\(address.suffix(4))" : address
  }

  public var typeTitle: String {
    switch type {
    case "safe": safeThreshold.map { "Safe, \($0) signatures needed" } ?? "Safe"
    case "personal": "Wallet"
    default: type.capitalized
    }
  }
}

/// `rpc_finance_crypto`. Crypto holdings, their wallets, and whether the source is working.
public struct FinanceCryptoPage: Sendable, Decodable {
  public let connected: Bool
  public let hasApiKey: Bool
  public let totalCents: Int
  public let stablecoinCents: Int
  public let unpricedTokenCount: Int
  public let holdings: [FinanceCryptoHolding]
  public let wallets: [FinanceWallet]
  public let lastError: String?

  private enum CodingKeys: String, CodingKey {
    case connected, hasApiKey, summary, holdings, wallets, lastError
  }
  private enum SummaryKeys: String, CodingKey {
    case totalCents, stablecoinCents, unpricedTokenCount
  }

  public init(from decoder: Decoder) throws {
    let container = try decoder.container(keyedBy: CodingKeys.self)
    connected = (try? container.decodeIfPresent(Bool.self, forKey: .connected)) ?? false
    hasApiKey = (try? container.decodeIfPresent(Bool.self, forKey: .hasApiKey)) ?? false
    let summary = try? container.nestedContainer(keyedBy: SummaryKeys.self, forKey: .summary)
    totalCents = (try? summary?.decodeIfPresent(Int.self, forKey: .totalCents)) ?? 0
    stablecoinCents = (try? summary?.decodeIfPresent(Int.self, forKey: .stablecoinCents)) ?? 0
    unpricedTokenCount =
      (try? summary?.decodeIfPresent(Int.self, forKey: .unpricedTokenCount)) ?? 0
    holdings = (try? container.decode([FinanceCryptoHolding].self, forKey: .holdings)) ?? []
    wallets = (try? container.decode([FinanceWallet].self, forKey: .wallets)) ?? []
    lastError = try? container.decodeIfPresent(String.self, forKey: .lastError)
  }

  public var isEmpty: Bool { wallets.isEmpty && holdings.isEmpty }
}

// MARK: - Spend, category, vendor, recurring

/// `rpc_finance_spend`. Spend over a period, with its category chips and transactions.
public struct FinanceSpendPage: Sendable, Decodable {
  public let period: String
  public let start: String?
  public let end: String?
  public let category: String?
  public let totalCents: Int
  public let categories: [FinanceBreakdown]
  public let transactions: [FinanceTransaction]

  private enum CodingKeys: String, CodingKey {
    case period, start, end, category, totalCents, categories, transactions
  }

  public init(from decoder: Decoder) throws {
    let container = try decoder.container(keyedBy: CodingKeys.self)
    period = container.decodeLossyString(.period) ?? "month"
    start = try? container.decodeIfPresent(String.self, forKey: .start)
    end = try? container.decodeIfPresent(String.self, forKey: .end)
    category = try? container.decodeIfPresent(String.self, forKey: .category)
    totalCents = (try? container.decodeIfPresent(Int.self, forKey: .totalCents)) ?? 0
    categories = (try? container.decode([FinanceBreakdown].self, forKey: .categories)) ?? []
    transactions = (try? container.decode([FinanceTransaction].self, forKey: .transactions)) ?? []
  }
}

/// `rpc_finance_category`. One category's spend, trend, vendors and newest charges.
public struct FinanceCategoryPage: Sendable, Decodable {
  public let slug: String
  public let label: String
  public let last90Cents: Int
  public let start: String?
  public let end: String?
  public let trend: [FinanceMonthCents]
  public let vendors: [FinanceBreakdown]
  public let recent: [FinanceTransaction]

  private enum CodingKeys: String, CodingKey {
    case slug, label, last90Cents, start, end, trend, vendors, recent
  }

  public init(from decoder: Decoder) throws {
    let container = try decoder.container(keyedBy: CodingKeys.self)
    slug = container.decodeLossyString(.slug) ?? ""
    label = container.decodeLossyString(.label) ?? slug
    last90Cents = (try? container.decodeIfPresent(Int.self, forKey: .last90Cents)) ?? 0
    start = try? container.decodeIfPresent(String.self, forKey: .start)
    end = try? container.decodeIfPresent(String.self, forKey: .end)
    trend = (try? container.decode([FinanceMonthCents].self, forKey: .trend)) ?? []
    vendors = (try? container.decode([FinanceBreakdown].self, forKey: .vendors)) ?? []
    recent = (try? container.decode([FinanceTransaction].self, forKey: .recent)) ?? []
  }
}

/// A subscription or fixed cost, with the charges behind it.
public struct FinanceRecurringCharge: Sendable, Hashable, Identifiable, Decodable {
  public let key: String
  public let name: String
  public let cadence: String
  public let amountCents: Int
  public let monthlyCents: Int
  public let variable: Bool
  public let chargeCount: Int
  public let lastChargeAt: String
  public let nextExpectedAt: String
  public let trendCents: [Int]
  public let classification: String
  public let paidWith: [FinancePaidWith]
  public let fixedCost: Bool
  public let cardBill: Bool
  public var id: String { key }

  private enum CodingKeys: String, CodingKey {
    case key, name, cadence, amountCents, monthlyCents, variable, chargeCount, lastChargeAt
    case nextExpectedAt, trendCents, classification, paidWith, fixedCost, cardBill
  }

  public init(from decoder: Decoder) throws {
    let container = try decoder.container(keyedBy: CodingKeys.self)
    key = container.decodeLossyString(.key) ?? UUID().uuidString
    name = container.decodeLossyString(.name) ?? key
    cadence = container.decodeLossyString(.cadence) ?? "monthly"
    amountCents = (try? container.decodeIfPresent(Int.self, forKey: .amountCents)) ?? 0
    monthlyCents = (try? container.decodeIfPresent(Int.self, forKey: .monthlyCents)) ?? 0
    variable = (try? container.decodeIfPresent(Bool.self, forKey: .variable)) ?? false
    chargeCount = (try? container.decodeIfPresent(Int.self, forKey: .chargeCount)) ?? 0
    lastChargeAt = container.decodeLossyString(.lastChargeAt) ?? ""
    nextExpectedAt = container.decodeLossyString(.nextExpectedAt) ?? ""
    trendCents = (try? container.decode([Int].self, forKey: .trendCents)) ?? []
    classification = container.decodeLossyString(.classification) ?? "spend"
    paidWith = (try? container.decode([FinancePaidWith].self, forKey: .paidWith)) ?? []
    fixedCost = (try? container.decodeIfPresent(Bool.self, forKey: .fixedCost)) ?? false
    cardBill = (try? container.decodeIfPresent(Bool.self, forKey: .cardBill)) ?? false
  }

  /// How often it charges, as words.
  public var cadenceTitle: String {
    switch cadence {
    case "weekly": "Weekly"
    case "biweekly": "Every 2 weeks"
    case "annual": "Yearly"
    default: "Monthly"
    }
  }
}

/// `rpc_finance_recurring`. One recurring charge and its recent history.
public struct FinanceRecurringPage: Sendable, Decodable {
  public let recurring: FinanceRecurringCharge
  public let pastCharges: [FinanceTransaction]

  private enum CodingKeys: String, CodingKey { case recurring, pastCharges }

  public init(from decoder: Decoder) throws {
    let container = try decoder.container(keyedBy: CodingKeys.self)
    recurring = try container.decode(FinanceRecurringCharge.self, forKey: .recurring)
    pastCharges = (try? container.decode([FinanceTransaction].self, forKey: .pastCharges)) ?? []
  }
}

/// `rpc_finance_vendor`. One vendor's spend, its average and its charges.
public struct FinanceVendorPage: Sendable, Decodable {
  public let key: String
  public let name: String
  public let isSubscription: Bool
  public let monthlyAvgCents: Int
  public let monthlyAvgMonths: Int?
  public let changePct: Double?
  public let firstSeenAt: String
  public let paidWith: [FinancePaidWith]
  public let monthly: [FinanceMonthCents]
  public let currentMonth: FinanceMonthCents?
  public let charges: [FinanceTransaction]

  private enum CodingKeys: String, CodingKey {
    case key, name, isSubscription, monthlyAvgCents, monthlyAvgMonths, changePct, firstSeenAt
    case paidWith, monthly, currentMonth, charges
  }

  public init(from decoder: Decoder) throws {
    let container = try decoder.container(keyedBy: CodingKeys.self)
    key = container.decodeLossyString(.key) ?? ""
    name = container.decodeLossyString(.name) ?? key
    isSubscription = (try? container.decodeIfPresent(Bool.self, forKey: .isSubscription)) ?? false
    monthlyAvgCents = (try? container.decodeIfPresent(Int.self, forKey: .monthlyAvgCents)) ?? 0
    monthlyAvgMonths = try? container.decodeIfPresent(Int.self, forKey: .monthlyAvgMonths)
    changePct = try? container.decodeIfPresent(Double.self, forKey: .changePct)
    firstSeenAt = container.decodeLossyString(.firstSeenAt) ?? ""
    paidWith = (try? container.decode([FinancePaidWith].self, forKey: .paidWith)) ?? []
    monthly = (try? container.decode([FinanceMonthCents].self, forKey: .monthly)) ?? []
    currentMonth = try? container.decodeIfPresent(FinanceMonthCents.self, forKey: .currentMonth)
    charges = (try? container.decode([FinanceTransaction].self, forKey: .charges)) ?? []
  }
}

// MARK: - Inputs

/// The month a month page shows.
public struct FinanceMonthInput: Encodable, Sendable {
  public let month: String

  public init(month: String) {
    self.month = month
  }
}

/// The period and optional category a spend page counts.
public struct FinanceSpendInput: Encodable, Sendable {
  public let period: String
  public let category: String?

  public init(period: String, category: String? = nil) {
    self.period = period
    self.category = category
  }
}

/// The category a category page shows, within the period it was opened from.
public struct FinanceCategoryInput: Encodable, Sendable {
  public let slug: String
  /// The dashboard period the category was opened from.
  public let period: String?
  /// A calendar month (`YYYY-MM`), which the contract keeps separate from `period`.
  public let month: String?

  public init(slug: String, period: String? = nil, month: String? = nil) {
    self.slug = slug
    self.period = period
    self.month = month
  }
}

/// The subscription or fixed cost a recurring page shows.
public struct FinanceRecurringInput: Encodable, Sendable {
  public let key: String

  public init(key: String) {
    self.key = key
  }
}

/// The vendor a vendor page shows.
public struct FinanceVendorInput: Encodable, Sendable {
  public let key: String

  public init(key: String) {
    self.key = key
  }
}

/// The transaction a detail page or receipt opens.
public struct FinanceTransactionInput: Encodable, Sendable {
  public let id: String

  public init(id: String) {
    self.id = id
  }
}

/// `rpc_finance_receiptUrl`, a short-lived vendor link fetched on demand.
public struct FinanceReceipt: Sendable, Decodable {
  public let url: String
  public let mimeType: String?

  private enum CodingKeys: String, CodingKey { case url, mimeType }

  public init(from decoder: Decoder) throws {
    let container = try decoder.container(keyedBy: CodingKeys.self)
    url = (try? container.decodeIfPresent(String.self, forKey: .url)) ?? ""
    mimeType = try? container.decodeIfPresent(String.self, forKey: .mimeType)
  }
}

/// The transaction whose receipt to open.
public struct FinanceReceiptInput: Encodable, Sendable {
  public let transactionId: String

  public init(transactionId: String) {
    self.transactionId = transactionId
  }
}
