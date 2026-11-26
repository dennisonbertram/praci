import Observation
import RakazoAPI

private struct MoveTicketInput: Encodable, Sendable {
  let id: String
  let status: String
}

@MainActor
@Observable
final class BoardModel {
  let page = PageLoader<[Ticket]>()
  var state: Loadable<[Ticket]> { page.state }
  var bots: [BotSummary] = []
  var refreshError: String? { page.refreshError }

  func load(_ app: AppModel) async {
    let requestedSpaceID = app.spaceID
    await page.load(spaceID: requestedSpaceID, isCurrent: { app.spaceID == requestedSpaceID }) {
      let result: TicketList = try await app.call("tickets/list")
      return result.tickets
    }
    guard requestedSpaceID == app.spaceID else { return }
    do {
      let loadedBots: [BotSummary] = try await app.call("bots/list")
      guard requestedSpaceID == app.spaceID else { return }
      bots = loadedBots
    } catch {
      guard requestedSpaceID == app.spaceID else { return }
      if refreshError == nil { page.setRefreshError(settingsErrorText(error)) }
    }
  }

  func move(_ ticket: Ticket, to status: TicketStatus, app: AppModel) async {
    do {
      let _: JSONValue = try await app.call(
        "tickets/move", input: MoveTicketInput(id: ticket.id, status: status.rawValue))
      await load(app)
    } catch { page.setRefreshError(settingsErrorText(error)) }
  }
}
