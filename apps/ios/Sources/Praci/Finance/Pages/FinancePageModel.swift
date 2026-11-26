import Foundation
import Observation
import RakazoAPI

/// The Finance sub-pages, in the order the Finance page links to them.
enum FinancePage: String, CaseIterable, Identifiable, Sendable {
  case accounts, burn, month, runway, crypto, upcoming, subscriptions, spend

  var id: String { rawValue }

  var title: String {
    switch self {
    case .accounts: "Accounts"
    case .burn: "Burn"
    case .month: "Month"
    case .runway: "Runway"
    case .crypto: "Crypto"
    case .upcoming: "Upcoming"
    case .subscriptions: "Subscriptions"
    case .spend: "Spend"
    }
  }
}

/// Loads one Finance sub-page. Each page owns its own model so leaving one never clears another.
@MainActor
@Observable
final class FinancePageModel<Value: Sendable & Decodable> {
  let page = PageLoader<Value>()
  var state: Loadable<Value> { page.state }
  /// Set when a refresh fails while earlier content is still on screen.
  var refreshError: String? { page.refreshError }

  var value: Value? { state.value }

  /// Runs one procedure and stores its answer, keeping the old value visible if a refresh fails.
  func load(_ app: AppModel, _ procedure: String) async {
    let requestedSpaceID = app.spaceID
    await page.load(spaceID: requestedSpaceID, isCurrent: { app.spaceID == requestedSpaceID }) { () async throws -> Value in
      await app.loadHideAmounts()
      return try await app.call(procedure)
    }
  }

  /// The same as `load`, for a procedure that needs an input.
  func load<Input: Encodable & Sendable>(
    _ app: AppModel, _ procedure: String, input: Input
  ) async {
    let requestedSpaceID = app.spaceID
    await page.load(spaceID: requestedSpaceID, isCurrent: { app.spaceID == requestedSpaceID }) { () async throws -> Value in
      await app.loadHideAmounts()
      return try await app.call(procedure, input: input)
    }
  }

}
