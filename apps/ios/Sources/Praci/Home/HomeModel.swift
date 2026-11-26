import Foundation
import Observation
import RakazoAPI

@MainActor
@Observable
final class HomeModel {
  var state: Loadable<Bootstrap> = .idle
  /// Unread mail count; nil until loaded or if it failed (the Inbox row then shows no count).
  var unread: Int?
  /// The glance is decorative and loads independently of the Home bootstrap.
  var glance: Glance?
  /// Set when a refresh fails while earlier data is still on screen.
  var refreshError: String?
  var agentsExpanded = false
  var collapsedSections: Set<String> = []

  @ObservationIgnored private var glanceTask: Task<Void, Never>?

  var roster: Roster? {
    state.value.map { Roster(bots: $0.bots, groups: $0.groups, sections: $0.botSections) }
  }

  func load(_ app: AppModel) async {
    if state.value == nil { state = .loading }
    // Badges and page counts never hold Home behind an optional endpoint.
    glanceTask?.cancel()
    glanceTask = Task { await loadGlance(app) }
    async let boot: Result<Bootstrap, Error> = fetch(app, "bootstrap")
    async let count: Result<UnreadCount, Error> = fetch(app, "inbox/unreadCount")
    let (bootResult, countResult) = await (boot, count)
    if Task.isCancelled { return }
    unread = (try? countResult.get())?.count ?? unread
    switch bootResult {
    case .success(let value):
      if state.value == nil {
        collapsedSections = Set(value.botSections.filter(\.collapsed).map(\.id))
      }
      state = .loaded(value)
      refreshError = nil
    case .failure(let error):
      if state.value == nil {
        state = .failed(error.localizedDescription)
      } else {
        refreshError = error.localizedDescription
      }
    }
  }

  func toggle(section id: String) {
    if !collapsedSections.insert(id).inserted { collapsedSections.remove(id) }
  }

  private func loadGlance(_ app: AppModel) async {
    guard let value: Glance = try? await app.call("notifications/glance"), !Task.isCancelled else { return }
    glance = value
  }

  private func fetch<T: Decodable & Sendable>(_ app: AppModel, _ procedure: String) async
    -> Result<T, Error>
  {
    do { return .success(try await app.call(procedure)) } catch { return .failure(error) }
  }
}
