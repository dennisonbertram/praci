import Foundation
import Observation
import RakazoAPI

private struct SpendInput: Encodable, Sendable { let period: String }
private struct TransactionInput: Encodable, Sendable { let id: String }

struct FinanceData: Sendable {
  let overview: FinanceOverview
  let accounts: FinanceAccounts
  let burn: FinanceBurn
}

enum FinancePeriod: String, CaseIterable, Identifiable {
  case week, month, quarter, year
  var id: String { rawValue }
}

@MainActor
@Observable
final class FinanceModel {
  let page = PageLoader<FinanceData>()
  var state: Loadable<FinanceData> { page.state }
  var spend: FinanceSpend?
  var period: FinancePeriod = .month
  /// Set when a sync or a change could not be saved; the previous figures stay on screen.
  var errorMessage: String?

  func load(_ app: AppModel) async {
    let requestedSpaceID = app.spaceID
    await app.loadHideAmounts()
    await page.load(spaceID: requestedSpaceID, isCurrent: { app.spaceID == requestedSpaceID }) {
      async let overview: FinanceOverview = app.call("finance/overview")
      async let accounts: FinanceAccounts = app.call("finance/accounts")
      async let burn: FinanceBurn = app.call("finance/burn")
      return try await FinanceData(overview: overview, accounts: accounts, burn: burn)
    }
    if app.spaceID == requestedSpaceID, let error = page.refreshError {
      errorMessage = error
    } else if page.state.value != nil {
      errorMessage = nil
      await loadSpend(app)
    }
  }

  func loadSpend(_ app: AppModel) async {
    let requestedSpaceID = app.spaceID
    do {
      let loadedSpend: FinanceSpend = try await app.call(
        "finance/spend", input: SpendInput(period: period.rawValue))
      guard app.spaceID == requestedSpaceID else { return }
      spend = loadedSpend
    } catch {
      if app.spaceID == requestedSpaceID { errorMessage = settingsErrorText(error) }
    }
  }

  /// Pull to refresh: sync the providers, then reload. A failed sync keeps the figures.
  func refresh(_ app: AppModel) async {
    do {
      let _: OKResult = try await app.call("finance/refresh", timeout: 60)
    } catch {
      errorMessage = error.localizedDescription
    }
    let failed = errorMessage
    await load(app)
    if let failed, errorMessage == nil { errorMessage = failed }
  }

  /// Flips the switch at once and puts it back if the server refuses.
  func setHideAmounts(_ value: Bool, _ app: AppModel) async {
    do {
      try await app.updateHideAmounts(value)
    } catch {
      errorMessage = settingsErrorText(error)
    }
  }

  func transaction(_ id: String, _ app: AppModel) async throws -> FinanceTransactionDetail {
    try await app.call("finance/transaction", input: TransactionInput(id: id))
  }
}
