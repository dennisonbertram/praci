import Foundation
import Observation
import RakazoAPI

/// The tabs the company page offers, in the order the interface shows them.
enum CompanyTab: String, CaseIterable, Identifiable, Sendable {
  case overview, people, organisations, history, review

  var id: String { rawValue }

  var title: String {
    switch self {
    case .overview: "Overview"
    case .people: "People"
    case .organisations: "Organisations"
    case .history: "History"
    case .review: "Review"
    }
  }

  /// The label that fits a segmented control on a phone, carrying the review count when there is one.
  func shortTitle(count: Int) -> String {
    switch self {
    case .overview: "All"
    case .organisations: "Orgs"
    case .review: count > 0 ? "Review \(count)" : "Review"
    default: title
    }
  }
}

@MainActor
@Observable
final class CompanyModel {
  var state: Loadable<CompanyPage> = .idle
  /// Set when a refresh fails while an earlier map is still on screen.
  var refreshError: String?
  /// Set when a confirm, reject or other action could not be completed.
  var actionError: String?
  var tab: CompanyTab = .overview {
    // An action error belongs to the row it was raised on; leaving the tab clears it.
    didSet { if tab != oldValue { actionError = nil } }
  }

  var page: CompanyPage? { state.value }

  func load(_ app: AppModel) async {
    if state.value == nil { state = .loading }
    do {
      let next: CompanyPage = try await app.call("company/page")
      state = .loaded(next)
      refreshError = nil
    } catch {
      if state.value == nil {
        state = .failed(error.localizedDescription)
      } else {
        refreshError = error.localizedDescription
      }
    }
  }

  /// Accepts a suggested fact as true, then reloads so every view agrees.
  func confirm(_ fact: CompanyFactInput, _ app: AppModel) async {
    await act(app) {
      let _: OKResult = try await app.call("company/confirm", input: fact)
    }
  }

  /// Throws a suggested fact away.
  func reject(_ fact: CompanyFactInput, _ app: AppModel) async {
    await act(app) {
      let _: OKResult = try await app.call("company/reject", input: fact)
    }
  }

  /// Runs one action and reloads, so a failed call leaves the old map intact.
  private func act(
    _ app: AppModel, _ work: () async throws -> Void
  ) async {
    do {
      try await work()
      actionError = nil
      await load(app)
    } catch {
      actionError = error.localizedDescription
    }
  }

  /// The rows the current tab shows, filtered by the search text.
  func entities(search: String) -> [CompanyEntity] {
    let rows = switch tab {
    case .people: page?.people ?? []
    case .organisations: page?.organisations ?? []
    case .overview, .history, .review: page?.entities ?? []
    }
    return rows
      .filter { search.isEmpty || $0.displayName.localizedCaseInsensitiveContains(search) }
      .sorted { $0.displayName.localizedCaseInsensitiveCompare($1.displayName) == .orderedAscending }
  }

  /// The events the current tab shows, newest first.
  func events(search: String) -> [CompanyEvent] {
    (page?.events ?? [])
      .filter { search.isEmpty || $0.title.localizedCaseInsensitiveContains(search) }
      .sorted { ($0.occursOn?.date ?? "") > ($1.occursOn?.date ?? "") }
  }
}
