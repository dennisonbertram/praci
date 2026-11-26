import Foundation
import Observation
import RakazoAPI
import RakazoCore

private struct Revoked: Decodable { let ok: Bool }

/// One bot's pages: the list, the shown page and its live data, and the share link made from this screen.
@MainActor
@Observable
final class AgentPageModel {
  let botID: String
  var state: Loadable<AgentPage?> = .idle
  var pages: [PageSummary] = []
  /// The page chosen in the menu; nil shows the bot's first page.
  var pageID: String?
  var live: PageData?
  /// The link made by Share, kept so Stop sharing can name its copy. Only this screen session knows it.
  var shared: PageShare?
  /// Set while the system share sheet is up.
  var sharing: PageShare?
  var busy = false
  var actionError: String?

  init(botID: String, pageID: String? = nil) {
    self.botID = botID
    self.pageID = pageID
  }

  var page: AgentPage? {
    state.value ?? nil
  }

  var blocks: [PageBlock] {
    guard let page else { return [] }
    return pageBlocks(
      content: page.content, chartSvgs: page.chartSvgs ?? [],
      live: liveBlocks(for: page, data: live) ?? []
    )
  }

  var htmlData: JSONValue? {
    htmlSources(for: page, data: live)
  }

  func load(_ app: AppModel) async {
    let requested = pageID
    if state.value == nil { state = .loading }
    async let preference: Void = app.loadHideAmounts()
    async let list: [PageSummary]? = try? await app.call("pages/list", input: PageRefInput(botId: botID))
    async let data: PageData? = try? await app.call("pages/data", input: PageRefInput(botId: botID, pageId: requested))
    do {
      let page: AgentPage? = try await app.call(
        "pages/get", input: PageGetInput(botId: botID, pageId: requested, chartSvgs: true), timeout: 20
      )
      guard requested == pageID else { return }
      state = .loaded(page)
    } catch {
      if requested == pageID, state.value == nil { state = .failed(error.localizedDescription) }
    }
    let (pages, live, _) = await (list, data, preference)
    guard requested == pageID else { return }
    if let pages { self.pages = pages }
    if let live { self.live = live }
  }

  func select(_ id: String, _ app: AppModel) async {
    guard id != (pageID ?? page?.id) else { return }
    pageID = id
    live = nil
    shared = nil
    state = .loading
    await load(app)
  }

  /// Reruns the page's sources. The blocks keep their last data when it fails.
  func refresh(_ app: AppModel) async {
    let requested = pageID
    let fresh: PageData? = try? await app.call(
      "pages/refresh", input: PageRefInput(botId: botID, pageId: requested), timeout: 30
    )
    if requested == pageID, let fresh { live = fresh }
  }

  func share(_ app: AppModel) async {
    busy = true
    defer { busy = false }
    do {
      let result: PageShare? = try await app.call(
        "pages/share", input: PageRefInput(botId: botID, pageId: pageID ?? page?.id), timeout: 30
      )
      guard let result else { return }
      shared = result
      sharing = result
    } catch {
      actionError = "Couldn’t share this page. \(error.localizedDescription)"
    }
  }

  func stopSharing(_ app: AppModel) async {
    guard let shared else { return }
    busy = true
    defer { busy = false }
    do {
      let _: Revoked = try await app.call(
        "artifactShares/revoke", input: ArtifactIDInput(artifactId: shared.artifactId)
      )
      self.shared = nil
    } catch {
      actionError = "Couldn’t stop sharing. \(error.localizedDescription)"
    }
  }
}
