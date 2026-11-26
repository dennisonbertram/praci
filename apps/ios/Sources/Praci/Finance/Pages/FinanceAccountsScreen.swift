import RakazoAPI
import RakazoUI
import SwiftUI

/// Every account the money sits in, with the total and the balance history.
struct FinanceAccountsScreen: View {
  @Environment(AppModel.self) private var app
  @State private var model = FinancePageModel<FinanceAccountsPage>()

  var body: some View {
    LoadableView(state: model.state, retry: { Task { await load() } }, content: { page in
      content(page, hidden: app.hideAmounts)
    })
    .background(Color.token(.background))
    .navigationTitle("Accounts")
    .navigationBarTitleDisplayMode(.inline)
    .task(id: app.spaceID) { await load() }
    .refreshable { await load() }
  }

  private func load() async {
    await model.load(app, "finance/accounts")
  }

  @ViewBuilder
  private func content(_ page: FinanceAccountsPage, hidden: Bool) -> some View {
    if page.isEmpty {
      ContentUnavailableView {
        Label("No accounts yet", systemImage: "building.columns")
      } description: {
        Text("Connect Mercury to see your accounts and balances.")
      }
      .accessibilityIdentifier("accountsEmpty")
    } else {
      List {
        Section("Total cash") {
          VStack(alignment: .leading, spacing: 2) {
            Text(financeMoney(page.totalCashCents, hidden: hidden))
              .font(.title2.monospacedDigit())
            if let owed = page.cardOwedCents, owed > 0 {
              Text("\(financeMoney(owed, hidden: hidden)) owed on cards")
                .font(.caption)
                .foregroundStyle(.secondary)
            }
          }
          .accessibilityIdentifier("accountsTotal")
        }
        if !page.cash.isEmpty {
          Section("Cash") {
            ForEach(page.cash) { account in
              NavigationLink(value: Route.financeAccount(id: account.id)) {
                AccountRow(account: account, hidden: hidden)
              }
              .accessibilityIdentifier("accountRow")
            }
          }
        }
        if !page.cards.isEmpty {
          Section("Cards") {
            ForEach(page.cards) { account in
              NavigationLink(value: Route.financeAccount(id: account.id)) {
                AccountRow(account: account, hidden: hidden)
              }
              .accessibilityIdentifier("cardRow")
            }
          }
        }
      }
      .listStyle(.insetGrouped)
    }
  }
}

/// One account: its name, institution and balance.
struct AccountRow: View {
  let account: FinanceAccount
  var hidden: Bool

  var body: some View {
    HStack(alignment: .firstTextBaseline) {
      VStack(alignment: .leading, spacing: 2) {
        Text(account.name.isEmpty ? account.provider.capitalized : account.name)
          .font(.body)
        HStack(spacing: 4) {
          Text(account.provider.capitalized)
          if let lastFour = account.lastFour { Text("· \(lastFour)") }
          if account.currency != "USD" { Text("· \(account.currency)") }
        }
        .font(.caption)
        .foregroundStyle(.secondary)
      }
      Spacer(minLength: 8)
      Text(financeMoney(account.balanceCents, currency: account.currency, hidden: hidden))
        .font(.callout.monospacedDigit())
    }
    .contentShape(.rect)
  }
}

/// One account with its history and newest transactions.
struct FinanceAccountScreen: View {
  let accountID: String

  @Environment(AppModel.self) private var app
  @State private var model = FinancePageModel<FinanceAccountPage>()

  var body: some View {
    LoadableView(state: model.state, retry: { Task { await load() } }, content: { page in
      content(page, hidden: app.hideAmounts)
    })
    .background(Color.token(.background))
    .navigationTitle(model.value?.account.name ?? "Account")
    .navigationBarTitleDisplayMode(.inline)
    .task(id: app.spaceID) { await load() }
    .refreshable { await load() }
  }

  private func load() async {
    await model.load(app, "finance/account", input: FinanceAccountInput(id: accountID))
  }

  @ViewBuilder
  private func content(_ page: FinanceAccountPage, hidden: Bool) -> some View {
    List {
      Section {
        AccountRow(account: page.account, hidden: hidden)
      }
      if !page.treasuryYield.isEmpty {
        Section("Treasury") {
          ForEach(page.treasuryYield.prefix(3)) { month in
            HStack {
              Text(CompanyDateText.month(month.month)).font(.callout)
              Spacer()
              if let pct = month.annualYieldPct {
                Text(pct.formatted(.number.precision(.fractionLength(1))) + "%")
                  .font(.caption.monospacedDigit())
                  .foregroundStyle(.secondary)
              }
              if let cents = month.yieldCents {
                Text(financeMoney(cents, hidden: hidden))
                  .font(.caption.monospacedDigit())
              }
            }
          }
        }
      }
      Section("Transactions") {
        if page.transactions.isEmpty {
          Text("No transactions yet").foregroundStyle(.secondary)
        }
        ForEach(page.transactions) { transaction in
          NavigationLink(value: Route.financeTransaction(id: transaction.id)) {
            FinanceTransactionRow(transaction: transaction, hidden: hidden)
          }
          .accessibilityIdentifier("accountTxnRow")
        }
      }
    }
    .listStyle(.insetGrouped)
  }
}

/// The input the account page takes.
private struct FinanceAccountInput: Encodable, Sendable {
  let id: String
}

/// A transaction as a list row: counterparty, date and amount.
struct FinanceTransactionRow: View {
  let transaction: FinanceTransaction
  var hidden: Bool

  var body: some View {
    HStack(alignment: .firstTextBaseline) {
      VStack(alignment: .leading, spacing: 2) {
        Text(transaction.counterparty.isEmpty ? transaction.memo ?? "—" : transaction.counterparty)
          .font(.body)
          .lineLimit(1)
        HStack(spacing: 4) {
          Text(CompanyDateText.day(String(transaction.postedAt.prefix(10))))
          if let category = transaction.category, !category.isEmpty {
            Text("· \(category)")
          }
        }
        .font(.caption)
        .foregroundStyle(.secondary)
      }
      Spacer(minLength: 8)
      Text(financeMoney(
        transaction.amountCents, currency: transaction.currency, hidden: hidden))
        .font(.callout.monospacedDigit())
        .foregroundStyle(
          transaction.amountCents > 0 ? Color.token(.success) : Color.token(.foreground))
    }
    .contentShape(.rect)
  }
}
