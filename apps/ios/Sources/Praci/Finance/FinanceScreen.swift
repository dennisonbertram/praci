import Charts
import RakazoAPI
import RakazoUI
import SwiftUI

struct FinanceScreen: View {
  @Environment(AppModel.self) private var app
  @State private var model = FinanceModel()

  var body: some View {
    LoadableView(state: model.state, retry: { Task { await model.load(app) } }, content: { data in
      if data.overview.isConnected || data.overview.hasCashAccounts {
        content(data)
      } else {
        ContentUnavailableView {
          Label("No accounts yet", systemImage: "banknote")
        } description: {
          Text("Connect Mercury or Brex")
        } actions: {
          PrimaryActionButton("Connect") { app.openSettings(.integrations) }
            .accessibilityIdentifier("financeConnect")
        }
      }
    })
    .navigationTitle("Finance")
    .navigationBarTitleDisplayMode(.inline)
    .toolbar {
      ToolbarItem(placement: .topBarTrailing) {
        Button {
          Task { await model.setHideAmounts(!app.hideAmounts, app) }
        } label: {
          Label(
            app.hideAmounts ? "Show amounts" : "Hide amounts",
            systemImage: app.hideAmounts ? "eye.slash" : "eye")
        }
        .accessibilityIdentifier("financeHideAmounts")
      }
    }
    .task(id: "\(app.spaceID ?? "none"):\(app.settingsClosings)") { await model.load(app) }
  }

  private func content(_ data: FinanceData) -> some View {
    let hidden = app.hideAmounts
    return List {
      Section {
        LabeledContent("Runway now", value: financeRunway(data.overview.runwayMonths, hidden: hidden))
          .accessibilityIdentifier("financeRunway")
        LabeledContent(
          "Cash today", value: financeMoney(data.overview.cashCents, hidden: hidden)
        )
        .accessibilityIdentifier("financeCash")
        LabeledContent(
          "Monthly burn", value: financeMoney(data.overview.monthlyBurnCents, hidden: hidden)
        )
        .accessibilityIdentifier("financeBurn")
      } footer: {
        footer(data.overview)
      }
      if !data.burn.series.isEmpty {
        Section("Monthly burn, 12 months") {
          BurnChart(series: data.burn.series, hidden: hidden)
        }
      }
      accounts(data.accounts, hidden: hidden)
      if !data.overview.upcoming.isEmpty {
        CappedSection(
          title: "Upcoming", items: data.overview.upcoming, spec: upcomingSpec()
        ) { item in
          LabeledContent {
            Text(financeMoney(item.amountCents, hidden: hidden))
          } label: {
            Text(item.name)
            if let date = item.dates.first {
              Text(financeDay(date)).foregroundStyle(Color.token(.mutedForeground))
            }
          }
        }
      }
      spendSections(data.overview, hidden: hidden)
      deeperSections(data.overview, hidden: hidden)
    }
    .refreshable { await model.refresh(app) }
    .accessibilityIdentifier("financeList")
  }

  @ViewBuilder
  private func footer(_ overview: FinanceOverview) -> some View {
    if let message = model.errorMessage {
      Text("Sync failed. \(message)").foregroundStyle(Color.token(.destructive))
    } else if let synced = overview.lastSyncedAt, let date = parseISO(synced) {
      Text("Synced \(date, format: .relative(presentation: .named))")
    }
  }

  @ViewBuilder
  private func accounts(_ accounts: FinanceAccounts, hidden: Bool) -> some View {
    let rows = accounts.cash + accounts.cards
    if !rows.isEmpty {
      CappedSection(title: "Accounts", items: rows, spec: accountsSpec(rows)) { account in
        LabeledContent {
          Text(financeMoney(account.balanceCents, currency: account.currency, hidden: hidden))
        } label: {
          Text(account.name)
          Text(accountSubtitle(account)).foregroundStyle(Color.token(.mutedForeground))
        }
      }
    }
  }

  /// The sub-pages, each showing a figure the dashboard only summarises.
  @ViewBuilder
  private func deeperSections(_ overview: FinanceOverview, hidden: Bool) -> some View {
    Section("Go deeper") {
      NavigationLink(value: Route.financeRunway) {
        LabeledContent {
          if let months = overview.runwayMonths {
            Text("\(months.formatted(.number.precision(.fractionLength(1)))) mo")
              .foregroundStyle(Color.token(.mutedForeground))
          }
        } label: {
          Label("Runway", systemImage: "calendar.badge.clock")
        }
      }
      .accessibilityIdentifier("financePageRunway")
      NavigationLink(value: Route.financeBurn) {
        LabeledContent {
          Text(financeMoney(overview.monthlyBurnCents, hidden: hidden))
            .foregroundStyle(Color.token(.mutedForeground))
        } label: {
          Label("Burn", systemImage: "flame")
        }
      }
      .accessibilityIdentifier("financePageBurn")
      NavigationLink(value: Route.financeAccounts) {
        Label("Accounts", systemImage: "building.columns")
      }
      .accessibilityIdentifier("financePageAccounts")
      NavigationLink(value: Route.financeSpend()) {
        Label("Spend", systemImage: "creditcard")
      }
      .accessibilityIdentifier("financePageSpend")
      NavigationLink(value: Route.financeSubscriptions) {
        LabeledContent {
          Text(financeMoney(overview.subscriptionsTotalCents, hidden: hidden))
            .foregroundStyle(Color.token(.mutedForeground))
        } label: {
          Label("Subscriptions", systemImage: "repeat")
        }
      }
      .accessibilityIdentifier("financePageSubscriptions")
      NavigationLink(value: Route.financeUpcoming) {
        Label("Upcoming", systemImage: "calendar")
      }
      .accessibilityIdentifier("financePageUpcoming")
      NavigationLink(value: Route.financeCrypto) {
        Label("Crypto", systemImage: "bitcoinsign.circle")
      }
      .accessibilityIdentifier("financePageCrypto")
    }
  }

  private func accountSubtitle(_ account: FinanceAccount) -> String {
    let provider = account.provider.capitalized
    return account.currency == "USD"
      ? provider : "\(provider), \(String(localized: "Not counted in cash"))"
  }

  @ViewBuilder
  private func spendSections(_ overview: FinanceOverview, hidden: Bool) -> some View {
    Section {
      Picker("Period", selection: $model.period) {
        ForEach(FinancePeriod.allCases) { Text($0.rawValue.capitalized).tag($0) }
      }
      .pickerStyle(.segmented)
      .accessibilityIdentifier("financePeriod")
      .onChange(of: model.period) { Task { await model.loadSpend(app) } }
    } header: {
      Text("Spend")
    } footer: {
      if overview.excludedNonUsdCount > 0 { Text(financeNonUSDNote(overview.excludedNonUsdCount)) }
    }
    if let spend = model.spend {
      if !spend.categories.isEmpty {
        CappedSection(title: "Where it went", items: spend.categories, spec: categoriesSpec()) { category in
          LabeledContent(category.label, value: financeMoney(category.cents, hidden: hidden))
        }
      }
      if !spend.transactions.isEmpty {
        CappedSection(
          title: "Transactions", items: spend.transactions, spec: transactionsSpec(spend.transactions)
        ) { transaction in
          NavigationLink {
            FinanceTransactionScreen(id: transaction.id, model: model, knownHidden: hidden)
          } label: {
            TransactionRow(transaction: transaction, hidden: hidden)
          }
        }
      }
    }
  }
}

private func parseISO(_ iso: String) -> Date? {
  let parser = ISO8601DateFormatter()
  parser.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
  return parser.date(from: iso) ?? ISO8601DateFormatter().date(from: iso)
}

private struct TransactionRow: View {
  let transaction: FinanceTransaction
  let hidden: Bool

  var body: some View {
    LabeledContent {
      Text(
        financeSignedMoney(
          transaction.amountCents, currency: transaction.currency, hidden: hidden))
    } label: {
      Text(transaction.counterparty)
      Text(subtitle).foregroundStyle(Color.token(.mutedForeground))
    }
    .accessibilityIdentifier("financeTransaction")
  }

  private var subtitle: String {
    var parts = [financeDay(transaction.postedAt)]
    if let category = transaction.category { parts.append(category) }
    if transaction.status == "pending" { parts.append(String(localized: "Pending")) }
    return parts.joined(separator: " · ")
  }
}

/// Twelve months of outflow. Swift Charts, a system framework.
private struct BurnChart: View {
  let series: [FinanceBurnMonth]
  let hidden: Bool

  var body: some View {
    Chart(series) { month in
      BarMark(
        x: .value("Month", financeMonthLabel(month.month)),
        y: .value("Out", Double(month.outCents) / 100)
      )
      .foregroundStyle(Color.token(.primary).opacity(month.partial ? 0.4 : 1))
    }
    .chartYAxis(hidden ? .hidden : .automatic)
    .frame(height: 140)
    .accessibilityIdentifier("financeBurnChart")
    .accessibilityLabel("Monthly burn chart")
  }
}
