import RakazoAPI
import RakazoUI
import SwiftUI

/// Bills and subscriptions due in the next weeks, with what they add up to.
struct FinanceUpcomingScreen: View {
  @Environment(AppModel.self) private var app
  @State private var model = FinancePageModel<FinanceOverview>()

  var body: some View {
    LoadableView(state: model.state, retry: { Task { await load() } }, content: { page in
      content(page, hidden: app.hideAmounts)
    })
    .background(Color.token(.background))
    .navigationTitle("Upcoming")
    .navigationBarTitleDisplayMode(.inline)
    .task(id: app.spaceID) { await load() }
    .refreshable { await load() }
  }

  private func load() async {
    await model.load(app, "finance/overview")
  }

  @ViewBuilder
  private func content(_ page: FinanceOverview, hidden: Bool) -> some View {
    let rows = page.upcoming.sorted { ($0.dates.first ?? "9999") < ($1.dates.first ?? "9999") }
    if rows.isEmpty {
      ContentUnavailableView {
        Label("Nothing due", systemImage: "calendar.badge.checkmark")
      } description: {
        Text("Bills and subscriptions due soon appear here.")
      }
      .accessibilityIdentifier("upcomingEmpty")
    } else {
      List {
        Section {
          ForEach(rows) { item in
            VStack(alignment: .leading, spacing: 3) {
              HStack(alignment: .firstTextBaseline) {
                Text(item.name).font(.body)
                Spacer(minLength: 8)
                Text(financeMoney(item.amountCents, hidden: hidden))
                  .font(.callout.monospacedDigit())
              }
              if let first = item.dates.first {
                Text(dueText(first, count: item.dates.count))
                  .font(.caption)
                  .foregroundStyle(.secondary)
              }
            }
            .accessibilityIdentifier("upcomingRow")
          }
        } header: {
          Text("Due soon")
        } footer: {
          let total = rows.reduce(0) { $0 + $1.amountCents * max($1.dates.count, 1) }
          Text("\(financeMoney(total, hidden: hidden)) in total across \(rows.count) items")
        }
      }
      .listStyle(.insetGrouped)
    }
  }

  /// "Due 2 Sep", noting when one item repeats inside the window.
  private func dueText(_ day: String, count: Int) -> String {
    let due = CompanyDateText.day(day)
    return count > 1 ? "Due \(due), and \(count - 1) more" : "Due \(due)"
  }
}

/// Every subscription, with its monthly cost and 4-month trend.
struct FinanceSubscriptionsScreen: View {
  @Environment(AppModel.self) private var app
  @State private var model = FinancePageModel<FinanceOverview>()

  var body: some View {
    LoadableView(state: model.state, retry: { Task { await load() } }, content: { page in
      content(page, hidden: app.hideAmounts)
    })
    .background(Color.token(.background))
    .navigationTitle("Subscriptions")
    .navigationBarTitleDisplayMode(.inline)
    .task(id: app.spaceID) { await load() }
    .refreshable { await load() }
  }

  private func load() async {
    await model.load(app, "finance/overview")
  }

  @ViewBuilder
  private func content(_ page: FinanceOverview, hidden: Bool) -> some View {
    if page.subscriptions.isEmpty {
      ContentUnavailableView {
        Label("No subscriptions", systemImage: "repeat")
      } description: {
        Text("Vendors that charge you on a schedule appear here.")
      }
      .accessibilityIdentifier("subscriptionsEmpty")
    } else {
      List {
        Section {
          ForEach(page.subscriptions.sorted { $0.monthlyCents > $1.monthlyCents }) { item in
            NavigationLink(value: Route.financeVendor(key: item.key)) {
              HStack(alignment: .firstTextBaseline) {
                VStack(alignment: .leading, spacing: 2) {
                  Text(item.name).font(.body)
                  if !item.lastChargeAt.isEmpty {
                    Text("Last charged \(CompanyDateText.day(String(item.lastChargeAt.prefix(10))))")
                      .font(.caption)
                      .foregroundStyle(.secondary)
                  }
                }
                Spacer(minLength: 8)
                Text(financeMoney(item.monthlyCents, hidden: hidden))
                  .font(.callout.monospacedDigit())
              }
            }
            .accessibilityIdentifier("subscriptionRow")
          }
        } footer: {
          Text("\(financeMoney(page.subscriptionsTotalCents, hidden: hidden)) a month")
        }
      }
      .listStyle(.insetGrouped)
    }
  }
}

/// Spend over a period, with category chips and the transactions behind them.
struct FinanceSpendScreen: View {
  let initialPeriod: String

  @Environment(AppModel.self) private var app
  @State private var model = FinancePageModel<FinanceSpendPage>()
  @State private var period: String
  @State private var category: String?

  init(initialPeriod: String = "month", initialCategory: String? = nil) {
    self.initialPeriod = initialPeriod
    _period = State(initialValue: initialPeriod)
    _category = State(initialValue: initialCategory)
  }

  var body: some View {
    LoadableView(state: model.state, retry: { Task { await load() } }, content: { page in
      content(page, hidden: app.hideAmounts)
    })
    .background(Color.token(.background))
    .navigationTitle("Spend")
    .navigationBarTitleDisplayMode(.inline)
    .toolbar {
      ToolbarItem(placement: .topBarTrailing) {
        Menu {
          Picker("Period", selection: $period) {
            Text("This week").tag("week")
            Text("This month").tag("month")
            Text("This quarter").tag("quarter")
            Text("This year").tag("year")
          }
          .pickerStyle(.inline)
        } label: {
          Label("Period", systemImage: "calendar")
        }
        .accessibilityIdentifier("spendPeriod")
      }
    }
    .task(id: app.spaceID) { await load() }
    .refreshable { await load() }
    .onChange(of: period) {
      // A new period starts from every category, so one reload covers both changes.
      category = nil
      Task { await load() }
    }
  }

  private func load() async {
    await model.load(
      app, "finance/spend", input: FinanceSpendInput(period: period, category: category))
  }

  @ViewBuilder
  private func content(_ page: FinanceSpendPage, hidden: Bool) -> some View {
    List {
      Section {
        VStack(alignment: .leading, spacing: 2) {
          Text(financeMoney(page.totalCents, hidden: hidden))
            .font(.title2.monospacedDigit())
          if let start = page.start, let end = page.end {
            // `end` is exclusive: the server counts up to the day before it, so naming it would
            // claim a day the total leaves out.
            Text("\(CompanyDateText.day(start)) – \(CompanyDateText.day(FinanceDay.before(end)))")
              .font(.caption)
              .foregroundStyle(.secondary)
          }
        }
        .accessibilityIdentifier("spendTotal")
      }
      if !page.categories.isEmpty {
        Section("Categories") {
          if category != nil {
            Button("All categories") { category = nil }
              .font(.callout)
          }
          ForEach(page.categories) { row in
            Button {
              category = row.key
              Task { await load() }
            } label: {
              BreakdownRow(row: row, total: page.totalCents, hidden: hidden)
            }
            .buttonStyle(.plain)
            .accessibilityIdentifier("spendCategoryRow")
          }
        }
      }
      Section("Transactions") {
        if page.transactions.isEmpty {
          Text("No spend in this period").foregroundStyle(.secondary)
        }
        ForEach(page.transactions) { transaction in
          NavigationLink(value: Route.financeTransaction(id: transaction.id)) {
            FinanceTransactionRow(transaction: transaction, hidden: hidden)
          }
          .accessibilityIdentifier("spendTxnRow")
        }
      }
    }
    .listStyle(.insetGrouped)
  }
}

/// One spending category: its trend, its vendors and its newest charges.
struct FinanceCategoryScreen: View {
  let slug: String
  /// The period the category was opened from, so its window matches the page that linked here.
  var period: String?
  /// A calendar month, when the link came from a month page.
  var month: String?

  @Environment(AppModel.self) private var app
  @State private var model = FinancePageModel<FinanceCategoryPage>()

  var body: some View {
    LoadableView(state: model.state, retry: { Task { await load() } }, content: { page in
      content(page, hidden: app.hideAmounts)
    })
    .background(Color.token(.background))
    .navigationTitle(model.value?.label ?? "Category")
    .navigationBarTitleDisplayMode(.inline)
    .task(id: app.spaceID) { await load() }
    .refreshable { await load() }
  }

  private func load() async {
    await model.load(
      app, "finance/category", input: FinanceCategoryInput(slug: slug, period: period, month: month))
  }

  @ViewBuilder
  private func content(_ page: FinanceCategoryPage, hidden: Bool) -> some View {
    List {
      Section {
        VStack(alignment: .leading, spacing: 2) {
          Text(financeMoney(page.last90Cents, hidden: hidden))
            .font(.title2.monospacedDigit())
          if let start = page.start, let end = page.end {
            // `end` is exclusive: the server counts up to the day before it, so naming it would
            // claim a day the total leaves out.
            Text("\(CompanyDateText.day(start)) – \(CompanyDateText.day(FinanceDay.before(end)))")
              .font(.caption)
              .foregroundStyle(.secondary)
          }
        }
        .accessibilityIdentifier("categoryTotal")
      }
      if !page.vendors.isEmpty {
        Section("Vendors") {
          ForEach(page.vendors) { row in
            NavigationLink(value: Route.financeVendor(key: row.key)) {
              BreakdownRow(row: row, total: page.last90Cents, hidden: hidden)
            }
            .accessibilityIdentifier("categoryVendorRow")
          }
        }
      }
      Section("Charges") {
        if page.recent.isEmpty {
          Text("No charges in this window").foregroundStyle(.secondary)
        }
        ForEach(page.recent) { transaction in
          NavigationLink(value: Route.financeTransaction(id: transaction.id)) {
            FinanceTransactionRow(transaction: transaction, hidden: hidden)
          }
          .accessibilityIdentifier("categoryChargeRow")
        }
      }
    }
    .listStyle(.insetGrouped)
  }
}
