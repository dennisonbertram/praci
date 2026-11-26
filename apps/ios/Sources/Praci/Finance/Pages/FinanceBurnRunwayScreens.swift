import RakazoAPI
import RakazoUI
import SwiftUI

/// What the business spends each month, where it went, and which accounts paid.
struct FinanceBurnScreen: View {
  @Environment(AppModel.self) private var app
  @State private var model = FinancePageModel<FinanceBurnPage>()

  var body: some View {
    LoadableView(state: model.state, retry: { Task { await load() } }, content: { page in
      content(page, hidden: app.hideAmounts)
    })
    .background(Color.token(.background))
    .navigationTitle("Burn")
    .navigationBarTitleDisplayMode(.inline)
    .task(id: app.spaceID) { await load() }
    .refreshable { await load() }
  }

  private func load() async {
    await model.load(app, "finance/burn")
  }

  @ViewBuilder
  private func content(_ page: FinanceBurnPage, hidden: Bool) -> some View {
    List {
      Section("Monthly burn") {
        VStack(alignment: .leading, spacing: 2) {
          Text(financeMoney(page.monthlyCents, hidden: hidden))
            .font(.title2.monospacedDigit())
          if let window = page.windowTitle {
            Text("Average of \(window)").font(.caption).foregroundStyle(.secondary)
          }
        }
        .accessibilityIdentifier("burnTotal")
      }
      if !page.series.isEmpty {
        Section("By month") {
          ForEach(page.series) { month in
            NavigationLink(value: Route.financeMonth(month: month.month)) {
              HStack {
                Text(CompanyDateText.month(month.month)).font(.callout)
                if month.partial {
                  Text("so far").font(.caption2).foregroundStyle(.tertiary)
                }
                Spacer()
                Text(financeMoney(month.outCents, hidden: hidden))
                  .font(.callout.monospacedDigit())
              }
            }
            .accessibilityIdentifier("burnMonthRow")
          }
        }
      }
      if !page.whereItWent.isEmpty {
        Section("Where it went") {
          ForEach(page.whereItWent) { row in
            NavigationLink(value: Route.financeCategory(slug: row.key)) {
              BreakdownRow(row: row, hidden: hidden)
            }
            .accessibilityIdentifier("burnCategoryRow")
          }
        }
      }
      if !page.byAccount.isEmpty {
        Section("By account") {
          ForEach(page.byAccount) { row in
            NavigationLink(value: Route.financeAccount(id: row.account.id)) {
              HStack {
                Text(row.account.name.isEmpty ? row.account.provider.capitalized : row.account.name)
                  .font(.callout)
                Spacer()
                Text(financeMoney(row.cents, hidden: hidden))
                  .font(.callout.monospacedDigit())
              }
            }
          }
        }
      }
    }
    .listStyle(.insetGrouped)
  }
}

/// A labelled money total with a share bar, used where the server already grouped spend.
struct BreakdownRow: View {
  let row: FinanceBreakdown
  var total: Int? = nil
  var hidden: Bool

  var body: some View {
    VStack(alignment: .leading, spacing: 3) {
      HStack(alignment: .firstTextBaseline) {
        Text(row.label).font(.body)
        Spacer(minLength: 8)
        Text(financeMoney(row.cents, hidden: hidden))
          .font(.callout.monospacedDigit())
      }
      if let total, total > 0 {
        ProgressView(value: Double(row.cents), total: Double(total))
          .progressViewStyle(.linear)
      }
    }
    .contentShape(.rect)
  }
}

/// How long the cash lasts, and what counts as cash.
struct FinanceRunwayScreen: View {
  @Environment(AppModel.self) private var app
  @State private var model = FinancePageModel<FinanceRunwayPage>()
  @State private var scope = "bank"

  var body: some View {
    LoadableView(state: model.state, retry: { Task { await load() } }, content: { page in
      content(page, hidden: app.hideAmounts)
    })
    .background(Color.token(.background))
    .navigationTitle("Runway")
    .navigationBarTitleDisplayMode(.inline)
    .task(id: app.spaceID) {
      await load()
      scope = model.value?.runwayCrypto ?? "bank"
    }
    .refreshable { await load() }
  }

  private func load() async {
    await model.load(app, "finance/runway")
  }

  @ViewBuilder
  private func content(_ page: FinanceRunwayPage, hidden: Bool) -> some View {
    List {
      Section {
        VStack(alignment: .leading, spacing: 4) {
          if let months = page.runwayMonths {
            Text("\(months.formatted(.number.precision(.fractionLength(1)))) months")
              .font(.title2.monospacedDigit())
          } else {
            Text("Not burning").font(.title3)
          }
          if let runOut = page.runOutDate {
            Text("Cash runs out \(CompanyDateText.day(runOut))")
              .font(.caption)
              .foregroundStyle(.secondary)
          }
        }
        .accessibilityIdentifier("runwayHeadline")
      }
      Section("Cash") {
        row("Counted", page.cashCents, hidden: hidden)
        row("Monthly burn", page.monthlyBurnCents, hidden: hidden)
      }
      Section("What counts as cash") {
        Picker("Cash scope", selection: $scope) {
          Text("Bank").tag("bank")
          Text("Stablecoins").tag("stablecoins")
          Text("All crypto").tag("all")
        }
        .pickerStyle(.inline)
        .labelsHidden()
        .accessibilityIdentifier("runwayScope")
        .onChange(of: scope) { _, next in
          guard next != page.runwayCrypto else { return }
          Task { await saveScope(next) }
        }
        row("Bank", page.breakdown.bankCents, hidden: hidden)
        if page.breakdown.stablecoinCents > 0 {
          row("Stablecoins", page.breakdown.stablecoinCents, hidden: hidden)
        }
        if page.breakdown.otherCryptoCents > 0 {
          row("Other crypto", page.breakdown.otherCryptoCents, hidden: hidden)
        }
        if page.breakdown.unpriced > 0 {
          Text("\(page.breakdown.unpriced) tokens have no price and are left out")
            .font(.caption)
            .foregroundStyle(.secondary)
        }
      }
      if !page.projection.isEmpty {
        Section("Next 24 months") {
          ForEach(page.projection.prefix(8)) { point in
            HStack {
              Text(CompanyDateText.month(point.month)).font(.callout)
              Spacer()
              Text(financeMoney(point.balanceCents, hidden: hidden))
                .font(.callout.monospacedDigit())
                .foregroundStyle(point.balanceCents < 0 ? Color.token(.destructive) : .primary)
            }
          }
        }
      }
    }
    .listStyle(.insetGrouped)
  }

  private func row(_ label: String, _ cents: Int, hidden: Bool) -> some View {
    HStack {
      Text(label).font(.callout)
      Spacer()
      Text(financeMoney(cents, hidden: hidden)).font(.callout.monospacedDigit())
    }
  }

  /// Saves the scope, then reloads so every figure agrees with the new one.
  private func saveScope(_ next: String) async {
    do {
      let _: FinancePreferences = try await app.call(
        "finance/setPreferences", input: FinancePreferences(runwayCrypto: next))
      await load()
    } catch {
      model.page.setRefreshError(settingsErrorText(error))
      scope = model.value?.runwayCrypto ?? "bank"
    }
  }
}
