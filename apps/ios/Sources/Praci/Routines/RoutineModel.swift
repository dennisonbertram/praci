import Foundation
import Observation
import RakazoAPI

@MainActor
@Observable
final class RoutineModel {
  let routineID: String
  let page = PageLoader<Routine>()
  var state: Loadable<Routine> { page.state }
  private(set) var runs: [RoutineRun] = []
  private(set) var nextCursor: RoutineCursor?
  private(set) var historyError: String?
  private(set) var actionError: String?
  private(set) var updating = false

  init(routineID: String) { self.routineID = routineID }

  /// The deep link carries only the routine id, so the routine is looked for in each agent's list.
  func load(_ app: AppModel) async {
    let requestedSpaceID = app.spaceID
    await page.load(
      spaceID: requestedSpaceID, isCurrent: { app.spaceID == requestedSpaceID },
      forceFailure: { $0 is RoutineMissingError }) {
      let bots: [BotSummary] = try await app.call("bots/list")
      for bot in bots {
        let list: [Routine] = try await app.call(
          "routines/list", input: RoutinesListInput(botId: bot.id))
        if let routine = list.first(where: { $0.id == routineID }) { return routine }
      }
      throw RoutineMissingError()
    }
    guard app.spaceID == requestedSpaceID else { return }
    if state.value != nil, page.refreshError == nil { await loadHistory(app, more: false) }
  }

  func loadHistory(_ app: AppModel, more: Bool) async {
    let requestedSpaceID = app.spaceID
    historyError = nil
    do {
      let history: RoutineHistory = try await app.call(
        "routines/history",
        input: RoutineHistoryInput(routineId: routineID, before: more ? nextCursor : nil))
      guard app.spaceID == requestedSpaceID else { return }
      runs = more ? runs + history.runs : history.runs
      nextCursor = history.nextCursor
    } catch {
      if app.spaceID == requestedSpaceID { historyError = error.localizedDescription }
    }
  }

  func setActive(_ active: Bool, app: AppModel) async {
    let requestedSpaceID = app.spaceID
    actionError = nil
    updating = true
    defer { updating = false }
    do {
      let updated: Routine = try await app.call(
        "routines/update", input: RoutineActiveInput(routineId: routineID, active: active))
      guard app.spaceID == requestedSpaceID else { return }
      page.setValue(updated)
    } catch {
      if app.spaceID == requestedSpaceID { actionError = error.localizedDescription }
    }
  }

  func dismissError() { actionError = nil }
}

private struct RoutineMissingError: LocalizedError {
  var errorDescription: String? { String(localized: "This routine no longer exists.") }
}
