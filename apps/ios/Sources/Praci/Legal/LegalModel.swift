import Foundation
import Observation
import RakazoAPI

private struct DeadlineUpdate: Encodable, Sendable {
  var id: String
  var status: String?
  var keep: Bool?
  var notes: String?
}

private struct ConsentGrant: Encodable, Sendable {
  var key: String
  var version: String
  var spaceId: String?
}

@MainActor
@Observable
final class LegalModel {
  let page = PageLoader<LegalOverview>()
  var state: Loadable<LegalOverview> { page.state }
  var refreshError: String? { page.refreshError }
  var consent: LegalConsent?
  var done: [LegalDeadline] = []
  var message: String?
  /// The deadline just closed, so the banner can offer Undo.
  var undoable: LegalDeadline?
  var isStartingScan = false
  var today = LegalDay.today()
  @ObservationIgnored private var undoTask: Task<Void, Never>?
  @ObservationIgnored private var pollTask: Task<Void, Never>?

  var overview: LegalOverview? { state.value }
  var isScanning: Bool { isStartingScan || (overview?.isScanRunning ?? false) }
  var needsModel: Bool { consent?.needsModel ?? false }
  var needsConsent: Bool { consent.map { !$0.allowed && !$0.recipients.isEmpty } ?? false }

  var openDeadlines: [LegalDeadline] { (overview?.deadlines ?? []).sortedByDue() }
  var dueSoon: [LegalDeadline] { openDeadlines.filter { LegalDay.isDueSoon($0.dueDate, today: today) } }
  var later: [LegalDeadline] { openDeadlines.filter { !LegalDay.isDueSoon($0.dueDate, today: today) } }

  func load(_ app: AppModel) async {
    today = LegalDay.today()
    await app.loadHideAmounts()
    let requestedSpaceID = app.spaceID
    await page.load(spaceID: requestedSpaceID, isCurrent: { app.spaceID == requestedSpaceID }) {
      try await app.call("legal/overview")
    }
    guard app.spaceID == requestedSpaceID else { return }
    if overview?.isScanRunning == true { startPolling(app) }
    let loadedConsent: LegalConsent? = try? await app.call("legal/consent")
    guard app.spaceID == requestedSpaceID else { return }
    if let loadedConsent { consent = loadedConsent }
    let loadedDone: [LegalDeadline]? = try? await app.call("legal/doneDeadlines")
    guard app.spaceID == requestedSpaceID else { return }
    if let loadedDone { done = loadedDone }
  }

  func grantConsent(_ app: AppModel) async {
    guard let consent else { return }
    do {
      self.consent = try await app.call(
        "legal/consentGrant",
        input: ConsentGrant(key: consent.key, version: consent.version, spaceId: consent.spaceId))
    } catch {
      message = settingsErrorText(error)
    }
  }

  func scan(_ app: AppModel) async {
    guard !isScanning else { return }
    message = nil
    isStartingScan = true
    defer { isStartingScan = false }
    do {
      let _: LegalScanStart = try await app.call("legal/scanNow", timeout: 20)
      await refresh(app)
      startPolling(app)
    } catch {
      message = settingsErrorText(error)
    }
  }

  /// Marks a deadline done or dismissed; the row leaves at once and Undo puts it back.
  func close(_ deadline: LegalDeadline, status: String, _ app: AppModel) async {
    let snapshot = state
    remove(deadline)
    do {
      let _: LegalDeadline = try await app.call(
        "legal/updateDeadline", input: DeadlineUpdate(id: deadline.id, status: status))
      undoable = deadline
      scheduleUndoExpiry()
      if let list: [LegalDeadline] = try? await app.call("legal/doneDeadlines") { done = list }
    } catch {
      page.setState(snapshot)
      message = settingsErrorText(error)
    }
  }

  func undo(_ app: AppModel) async {
    guard let deadline = undoable else { return }
    undoable = nil
    await reopen(deadline, app)
  }

  func reopen(_ deadline: LegalDeadline, _ app: AppModel) async {
    do {
      let _: LegalDeadline = try await app.call(
        "legal/updateDeadline", input: DeadlineUpdate(id: deadline.id, status: "open"))
      await refresh(app)
      if let list: [LegalDeadline] = try? await app.call("legal/doneDeadlines") { done = list }
    } catch {
      message = settingsErrorText(error)
    }
  }

  /// Keeps a deadline the scan proposed to remove.
  func keep(_ deadline: LegalDeadline, _ app: AppModel) async {
    do {
      let _: LegalDeadline = try await app.call(
        "legal/updateDeadline", input: DeadlineUpdate(id: deadline.id, keep: true))
      await refresh(app)
    } catch {
      message = settingsErrorText(error)
    }
  }

  func stop() {
    pollTask?.cancel()
    undoTask?.cancel()
  }

  private func refresh(_ app: AppModel) async {
    if let next: LegalOverview = try? await app.call("legal/overview") { page.setValue(next) }
  }

  private func remove(_ deadline: LegalDeadline) {
    guard var next = overview else { return }
    next.deadlines.removeAll { $0.id == deadline.id }
    page.setValue(next)
  }

  private func scheduleUndoExpiry() {
    undoTask?.cancel()
    undoTask = Task { [weak self] in
      try? await Task.sleep(for: .seconds(8))
      if !Task.isCancelled { self?.undoable = nil }
    }
  }

  /// Re-reads while a scan runs; gives up after five minutes.
  private func startPolling(_ app: AppModel) {
    guard pollTask == nil || pollTask?.isCancelled == true else { return }
    pollTask = Task { [weak self] in
      for _ in 0..<75 {
        try? await Task.sleep(for: .seconds(4))
        guard !Task.isCancelled, let self else { return }
        await refresh(app)
        if !(overview?.isScanRunning ?? false) { break }
      }
      self?.pollTask = nil
    }
  }
}
