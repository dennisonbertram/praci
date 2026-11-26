import Foundation
import Observation
import RakazoAPI
import RakazoCore

struct BrexPageData: Sendable {
  let overview: BrexCardsOverview
  let cards: BrexCardsView
  let limits: BrexLimits
  let activity: BrexActivity
}

private struct BrexThreadMessageInput: Encodable, Sendable {
  let botId: String
  let text: String
  let clientNonce: String
}

private struct BrexThreadMessageResult: Decodable, Sendable {
  let runId: String?
}

@MainActor
@Observable
final class BrexModel {
  let page = PageLoader<BrexPageData>()
  var state: Loadable<BrexPageData> { page.state }
  var unavailable = false
  var actionError: String?
  var refreshError: String? { page.refreshError }
  var isSending = false

  func load(_ app: AppModel) async {
    let requestedSpaceID = app.spaceID
    await app.loadHideAmounts()
    await page.load(
      spaceID: requestedSpaceID, isCurrent: { app.spaceID == requestedSpaceID },
      onError: { self.unavailable = self.isNotFound($0) },
      onSuccess: { _ in self.unavailable = false }) {
      async let overview: BrexCardsOverview = app.call("brexCards/overview")
      async let cards: BrexCardsView = app.call("brexCards/cardsView")
      async let limits: BrexLimits = app.call("brexCards/limits")
      async let activity: BrexActivity = app.call("brexCards/activity")
      let (overviewValue, cardsValue, limitsValue, activityValue) = try await
        (overview, cards, limits, activity)
      let data = BrexPageData(
          overview: overviewValue, cards: cardsValue, limits: limitsValue,
          activity: activityValue)
      return data
    }
  }

  func send(_ message: String, botID: String, app: AppModel) async {
    guard !isSending else { return }
    isSending = true
    actionError = nil
    do {
      try await app.consent.ensure(procedure: "threads/send", app: app)
      let _: BrexThreadMessageResult = try await app.call(
        "threads/send",
        input: BrexThreadMessageInput(
          botId: botID, text: message, clientNonce: UUID().uuidString.lowercased()),
        timeout: 20)
      isSending = false
      app.open(.thread(.bot(botID)))
    } catch {
      isSending = false
      actionError = error.localizedDescription
    }
  }

  private func isNotFound(_ error: Error) -> Bool {
    guard let rpcError = error as? RPCError else { return false }
    return switch rpcError {
    case .notSupported, .server(code: "NOT_FOUND", status: _, message: _): true
    default: false
    }
  }
}
