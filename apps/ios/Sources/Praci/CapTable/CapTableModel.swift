import Observation
import RakazoAPI

@MainActor
@Observable
final class CapTableModel {
  let page = PageLoader<CapTableResult>()
  var state: Loadable<CapTableResult> { page.state }
  var refreshError: String? { page.refreshError }
  var agentID: String?
  private var agentSpaceID: String?

  func load(_ app: AppModel) async {
    let requestedSpaceID = app.spaceID
    if agentSpaceID != requestedSpaceID {
      agentSpaceID = requestedSpaceID
      agentID = nil
    }
    await app.loadHideAmounts()
    guard app.spaceID == requestedSpaceID else { return }
    await page.load(spaceID: requestedSpaceID, isCurrent: { app.spaceID == requestedSpaceID }) {
      try await app.call("investors/capTable")
    }
    guard app.spaceID == requestedSpaceID else { return }
    if agentID == nil, let agent: CartaAgent = try? await app.call("carta/agent") {
      guard app.spaceID == requestedSpaceID else { return }
      agentID = agent.id
    }
  }
}

/// `rpc_carta_agent`: only the id is needed to open its thread.
struct CartaAgent: Decodable, Sendable { let id: String }
