import Foundation
import Observation
import RakazoAPI
import RakazoCore

@MainActor
@Observable
final class FundraisingModel {
  let page = PageLoader<FundraisingOverview>()
  var state: Loadable<FundraisingOverview> { page.state }
  var refreshError: String? { page.refreshError }
  var undoCall: CallUndoToast?
  var actionError: String?

  func load(_ app: AppModel) async {
    let requestedSpaceID = app.spaceID
    await page.load(spaceID: requestedSpaceID, isCurrent: { app.spaceID == requestedSpaceID }) {
      try await app.call("fundraising/overview")
    }
  }

  func logCall(
    _ prospect: FundraisingProspect, outcome: String, note: String,
    next: FundraisingCallLogInput.NextCall, app: AppModel
  ) async -> Bool {
    do {
      let result: FundraisingCallLogResult = try await app.call(
        "fundraising/calls/log",
        input: FundraisingCallLogInput(
          id: prospect.id, outcome: outcome, note: note.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
            ? nil : note, nextCall: next))
      undoCall = CallUndoToast(
        eventId: result.eventId,
        title: result.movedToMet ? "Call logged. \(prospect.name) moved to Met" : "Call logged")
      Task { await load(app) }
      return true
    } catch {
      actionError = error.localizedDescription
      return false
    }
  }

  func undoLoggedCall(_ eventId: String, app: AppModel) async {
    do {
      let _: JSONValue = try await app.call("fundraising/calls/undo", input: EventIDInput(eventId: eventId))
      undoCall = nil
      await load(app)
    } catch { actionError = error.localizedDescription }
  }

  func dismissUndo(_ eventId: String) {
    if undoCall?.eventId == eventId { undoCall = nil }
  }

  func mark(_ safe: FundraisingSafe, action: String, app: AppModel) async {
    guard safe.source == "native", let day = localDay(Date()),
      let at = pipelineCallISO(day: day)
    else { return }
    do {
      let _: FundraisingSafe = try await app.call(
        "fundraising/safes/mark",
        input: FundraisingSafeMarkInput(id: safe.id, action: action, at: at))
      await load(app)
    } catch { actionError = error.localizedDescription }
  }

  var pipeline: [PipelineRow] {
    guard let prospects = state.value?.prospects, let today = localDay(Date()) else { return [] }
    let contacts = prospects.map { prospect in
      PipelineContact(
        id: prospect.id,
        name: prospect.pipelineRecord?.name ?? prospect.name,
        stage: prospect.stage,
        status: prospect.pipelineRecord?.status,
        nextCallAt: prospect.pipelineRecord?.nextCallAt,
        nextCallHasTime: prospect.pipelineRecord?.nextCallHasTime ?? false)
    }
    return pipelineRows(contacts, today: today)
  }

  private func localDay(_ date: Date) -> String? {
    var calendar = Calendar(identifier: .gregorian)
    calendar.timeZone = .current
    let parts = calendar.dateComponents([.year, .month, .day], from: date)
    guard let year = parts.year, let month = parts.month, let day = parts.day else { return nil }
    return String(format: "%04d-%02d-%02d", year, month, day)
  }
}

struct CallUndoToast: Identifiable, Equatable {
  let eventId: String
  let title: String
  var id: String { eventId }
}

private struct EventIDInput: Encodable, Sendable {
  let eventId: String
}
