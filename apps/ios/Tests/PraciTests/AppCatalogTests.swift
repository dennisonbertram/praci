import Foundation
import RakazoAPI
import Testing

@testable import Praci

private func entry(_ slug: String, connected: Bool = false) throws -> ConnectorEntry {
  try JSONDecoder().decode(
    ConnectorEntry.self,
    from: Data(
      #"{"connectorId":"k","slug":"\#(slug)","name":"\#(slug.capitalized)","connected":\#(connected)}"#.utf8))
}

private struct Boom: Error, LocalizedError { var errorDescription: String? { "boom" } }

/// Holds a search open until the test lets it finish.
private actor Gate {
  private var waiting: CheckedContinuation<Void, Never>?
  private(set) var started = false
  func wait() async {
    started = true
    await withCheckedContinuation { waiting = $0 }
  }
  func open() {
    waiting?.resume()
    waiting = nil
  }
}

@MainActor
private final class Calls {
  var queries: [String] = []
  var failNext = false
}

@MainActor
private func catalog(_ calls: Calls, gate: Gate? = nil) -> AppCatalog {
  AppCatalog(
    featured: { [try entry("gmail"), try entry("slack")] },
    search: { text in
      await MainActor.run { calls.queries.append(text) }
      if text == "slow", let gate { await gate.wait() }
      if await MainActor.run(body: { calls.failNext }) { throw Boom() }
      return [try entry(text)]
    },
    pause: { try Task.checkCancellation() })
}

@MainActor @Test func featuredLoadsWithoutSearching() async throws {
  let calls = Calls()
  let apps = catalog(calls)
  await apps.loadFeatured()
  #expect(apps.featured.map(\.slug) == ["gmail", "slack"])
  #expect(apps.results == nil)
  #expect(calls.queries.isEmpty)
}

@MainActor @Test func typingSearchesOnceAfterThePause() async throws {
  let calls = Calls()
  let apps = catalog(calls)
  apps.setQuery("a")
  apps.setQuery("ab")
  await apps.task?.value
  #expect(calls.queries == ["ab"])
  #expect(apps.results?.map(\.slug) == ["ab"])
  #expect(!apps.searching)
}

@MainActor @Test func staleResponseIsIgnored() async throws {
  let calls = Calls()
  let gate = Gate()
  let apps = catalog(calls, gate: gate)
  apps.setQuery("slow")
  let first = apps.task
  while !(await gate.started) { await Task.yield() }
  apps.setQuery("fast")
  await apps.task?.value
  await gate.open()
  await first?.value
  #expect(apps.results?.map(\.slug) == ["fast"])
  #expect(!apps.searching)
}

@MainActor @Test func clearingTheFieldReturnsToFeatured() async throws {
  let apps = catalog(Calls())
  await apps.loadFeatured()
  apps.setQuery("x")
  await apps.task?.value
  apps.setQuery("  ")
  #expect(apps.results == nil)
  #expect(!apps.searching)
  #expect(apps.searchError == nil)
  #expect(apps.featured.count == 2)
}

@MainActor @Test func failedSearchShowsAnErrorAndRetryRecovers() async throws {
  let calls = Calls()
  let apps = catalog(calls)
  calls.failNext = true
  apps.setQuery("x")
  await apps.task?.value
  #expect(apps.searchError != nil)
  #expect(apps.results == nil)
  #expect(!apps.searching)
  calls.failNext = false
  apps.retry()
  await apps.task?.value
  #expect(apps.searchError == nil)
  #expect(apps.results?.map(\.slug) == ["x"])
}

@MainActor @Test func failedFeaturedKeepsAnErrorNotABlankList() async throws {
  let apps = AppCatalog(featured: { throw Boom() }, search: { _ in [] }, pause: {})
  await apps.loadFeatured()
  #expect(apps.featuredError != nil)
  #expect(apps.featured.isEmpty)
}

@Test func availableDropsConnectedApps() throws {
  let connections = try JSONDecoder().decode(
    [Connection].self, from: Data(#"[{"id":"c","provider":"gmail","status":"connected"}]"#.utf8))
  let shown = availableApps(
    [try entry("gmail"), try entry("slack"), try entry("x", connected: true)], connections)
  #expect(shown.map(\.slug) == ["slack"])
}
