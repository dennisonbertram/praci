import RakazoAPI
import RakazoUI
import SwiftUI

/// Crypto the business holds, across every wallet it watches.
struct FinanceCryptoScreen: View {
  @Environment(AppModel.self) private var app
  @State private var model = FinancePageModel<FinanceCryptoPage>()

  var body: some View {
    LoadableView(state: model.state, retry: { Task { await load() } }, content: { page in
      content(page, hidden: app.hideAmounts)
    })
    .background(Color.token(.background))
    .navigationTitle("Crypto")
    .navigationBarTitleDisplayMode(.inline)
    .task(id: app.spaceID) { await load() }
    .refreshable { await load() }
  }

  private func load() async {
    await model.load(app, "finance/crypto")
  }

  @ViewBuilder
  private func content(_ page: FinanceCryptoPage, hidden: Bool) -> some View {
    if page.isEmpty && !page.connected {
      ContentUnavailableView {
        Label("Crypto isn’t connected", systemImage: "bitcoinsign.circle")
      } description: {
        Text("Connect a wallet or exchange to see balances here.")
      }
      .accessibilityIdentifier("cryptoEmpty")
    } else {
      List {
        if let lastError = page.lastError, !lastError.isEmpty {
          Section {
            Label(lastError, systemImage: "exclamationmark.triangle")
              .font(.footnote)
              .foregroundStyle(Color.token(.warning))
          }
        }
        Section("Total") {
          VStack(alignment: .leading, spacing: 2) {
            Text(financeMoney(page.totalCents, hidden: hidden))
              .font(.title2.monospacedDigit())
            if page.stablecoinCents > 0 {
              Text("\(financeMoney(page.stablecoinCents, hidden: hidden)) in stablecoins")
                .font(.caption)
                .foregroundStyle(.secondary)
            }
            if page.unpricedTokenCount > 0 {
              Text("\(page.unpricedTokenCount) tokens have no price and are left out")
                .font(.caption)
                .foregroundStyle(.secondary)
            }
          }
          .accessibilityIdentifier("cryptoTotal")
        }
        if !page.holdings.isEmpty {
          Section("Holdings") {
            ForEach(page.holdings) { holding in
              HStack {
                VStack(alignment: .leading, spacing: 1) {
                  Text(holding.symbol).font(.body)
                  Text(holding.name).font(.caption).foregroundStyle(.secondary)
                }
                Spacer()
                if let cents = holding.usdValueCents {
                  Text(financeMoney(cents, hidden: hidden))
                    .font(.callout.monospacedDigit())
                } else {
                  Text("No price").font(.caption).foregroundStyle(.secondary)
                }
              }
              .accessibilityIdentifier("holdingRow")
            }
          }
        }
        if !page.wallets.isEmpty {
          Section("Wallets") {
            ForEach(page.wallets) { wallet in
              VStack(alignment: .leading, spacing: 2) {
                Text(wallet.title).font(.body)
                Text("\(wallet.typeTitle) · \(wallet.shortAddress)")
                  .font(.caption)
                  .foregroundStyle(.secondary)
              }
              .accessibilityIdentifier("walletRow")
            }
          }
        }
        if let lastError = page.lastError, lastError.isEmpty, !page.connected {
          Section {
            Text("Connect a wallet to keep balances current.")
              .font(.footnote)
              .foregroundStyle(.secondary)
          }
        }
      }
      .listStyle(.insetGrouped)
    }
  }
}

/// One calendar month's money in and out.
struct FinanceMonthScreen: View {
  let month: String

  @Environment(AppModel.self) private var app
  @State private var model = FinancePageModel<FinanceMonthPage>()

  var body: some View {
    LoadableView(state: model.state, retry: { Task { await load() } }, content: { page in
      content(page, hidden: app.hideAmounts)
    })
    .background(Color.token(.background))
    .navigationTitle(CompanyDateText.month(month))
    .navigationBarTitleDisplayMode(.inline)
    .task(id: app.spaceID) { await load() }
    .refreshable { await load() }
  }

  private func load() async {
    await model.load(app, "finance/month", input: FinanceMonthInput(month: month))
  }

  @ViewBuilder
  private func content(_ page: FinanceMonthPage, hidden: Bool) -> some View {
    List {
      Section {
        VStack(alignment: .leading, spacing: 6) {
          HStack(spacing: 20) {
            figure("Out", page.outCents, hidden: hidden)
            figure("In", page.inCents, hidden: hidden)
            figure(
              "Net", page.netCents, hidden: hidden,
              tint: page.netCents < 0 ? .destructive : .success)
          }
          if page.partial {
            Text("This month is still in progress.").font(.caption).foregroundStyle(.secondary)
          }
        }
        .accessibilityIdentifier("monthFigures")
      }
      if !page.categories.isEmpty {
        Section("Where it went") {
          ForEach(page.categories) { row in
            NavigationLink(value: Route.financeCategory(slug: row.key)) {
              BreakdownRow(row: row, total: page.outCents, hidden: hidden)
            }
            .accessibilityIdentifier("monthCategoryRow")
          }
        }
      }
      Section("Transactions") {
        if page.transactions.isEmpty {
          Text("No transactions this month").foregroundStyle(.secondary)
        }
        ForEach(page.transactions) { transaction in
          NavigationLink(value: Route.financeTransaction(id: transaction.id)) {
            FinanceTransactionRow(transaction: transaction, hidden: hidden)
          }
          .accessibilityIdentifier("monthTxnRow")
        }
      }
    }
    .listStyle(.insetGrouped)
  }

  private func figure(
    _ label: String, _ cents: Int, hidden: Bool, tint: SemanticColor = .foreground
  ) -> some View {
    VStack(alignment: .leading, spacing: 1) {
      Text(label).font(.caption2).foregroundStyle(.secondary)
      Text(tint == .foreground ? financeMoney(cents, hidden: hidden)
        : financeSignedTotal(cents, hidden: hidden))
        .font(.callout.monospacedDigit())
        .foregroundStyle(Color.token(tint))
    }
  }
}
