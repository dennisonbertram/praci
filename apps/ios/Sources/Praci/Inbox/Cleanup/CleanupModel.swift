import Foundation
import Observation
import RakazoAPI

/// The cleanup operations. `live` calls the server; tests supply fakes.
struct CleanupClient: Sendable {
  var list: @MainActor @Sendable () async throws -> CleanupList
  var api: CleanupLogic.Api
  var undo: @MainActor @Sendable (_ batchID: String) async throws -> Void
}

private struct ListInput: Encodable, Sendable { var connectionId: String? }
private struct ArchiveInput: Encodable, Sendable {
  let kind: String, connectionId: String, address: String
  let batchId: String?
}
private struct UnsubscribeInput: Encodable, Sendable {
  let connectionId: String, address: String
  let confirmMailto: Bool?
}
private struct UndoInput: Encodable, Sendable { let batchId: String }
private struct UndoOutput: Decodable, Sendable { let restored: Int }

extension CleanupClient {
  @MainActor
  static func live(_ app: AppModel) -> CleanupClient {
    CleanupClient(
      list: { try await app.call("inbox/cleanup/list", input: ListInput(), timeout: 30) },
      api: CleanupLogic.Api(
        archive: { kind, sender, batch in
          try await app.call(
            "inbox/cleanup/archive",
            input: ArchiveInput(
              kind: kind.rawValue, connectionId: sender.connectionId, address: sender.address,
              batchId: batch),
            timeout: 60)
        },
        unsubscribe: { sender, confirm in
          try await app.call(
            "inbox/unsubscribe",
            input: UnsubscribeInput(
              connectionId: sender.connectionId, address: sender.address,
              confirmMailto: confirm ? true : nil),
            timeout: 60)
        }),
      undo: { id in
        let _: UndoOutput = try await app.call("inbox/actions/undo", input: UndoInput(batchId: id), timeout: 60)
      })
  }
}

@MainActor
@Observable
final class CleanupModel {
  /// What the last run did, for the Done view.
  struct Summary: Equatable {
    var kind: CleanupKind
    var senders: [CleanupSender]
    var done: Int
    var batchIDs: [String]
    var failures: [String]
    var links: [URL]
    var undone = false
  }

  enum Phase: Equatable {
    case selecting
    case running(CleanupKind)
    case done(Summary)
    /// Nothing changed; "Try again" repeats the same choice.
    case failed(CleanupKind, String)
  }

  private(set) var state: Loadable<CleanupList> = .idle
  private(set) var phase = Phase.selecting
  var selected: Set<String> = []
  /// Unsubscribe emails waiting for the user's OK, one at a time.
  private(set) var pendingMail: [(sender: CleanupSender, mailTo: String)] = []
  var actionError: String?

  @ObservationIgnored private let client: CleanupClient
  @ObservationIgnored private var task: Task<Void, Never>?
  @ObservationIgnored private var lastTargets: [CleanupSender] = []

  init(client: CleanupClient) { self.client = client }

  var senders: [CleanupSender] { CleanupLogic.rank(state.value?.senders ?? []) }

  func targets(_ kind: CleanupKind) -> [CleanupSender] {
    CleanupLogic.targets(kind, senders: senders, selected: selected)
  }

  /// Emails the Archive choice would move: the selected senders' inbox threads.
  var archiveCount: Int { CleanupLogic.threadCount(targets(.archive)) }
  var unsubscribeCount: Int { targets(.unsubscribe).count }

  func load() async {
    if case .loaded = state { return }
    await reload()
  }

  func reload() async {
    state = .loading
    do {
      let list = try await client.list()
      state = .loaded(list)
      selected = Set(list.senders.filter(\.preselected).map(\.id))
    } catch {
      state = .failed(text(error))
    }
  }

  func toggle(_ sender: CleanupSender) {
    if selected.contains(sender.id) { selected.remove(sender.id) } else { selected.insert(sender.id) }
  }

  /// Runs one confirmed choice. Archive and Unsubscribe are separate: archive never unsubscribes.
  func run(_ kind: CleanupKind, senders: [CleanupSender]? = nil) {
    guard task == nil else { return }
    let chosen = senders ?? targets(kind)
    guard !chosen.isEmpty else { return }
    lastTargets = chosen
    phase = .running(kind)
    task = Task { [client] in
      let result = await CleanupLogic.run(kind, senders: chosen, api: client.api)
      finish(kind, chosen, result)
    }
  }

  func cancel() { task?.cancel() }

  func retry() {
    if case .failed(let kind, _) = phase { phase = .selecting; run(kind, senders: lastTargets) }
  }

  func answerMail(send: Bool) {
    guard !pendingMail.isEmpty else { return }
    let next = pendingMail.removeFirst()
    guard send else { return }
    task = Task { [client] in
      let result = await CleanupLogic.run(.unsubscribe, senders: [next.sender], api: client.api, confirmMailto: true)
      finish(.unsubscribe, [next.sender], result)
    }
    phase = .running(.unsubscribe)
  }

  /// Undo is offered once, on the Done view.
  func undo() async {
    guard case .done(var summary) = phase, !summary.undone else { return }
    do {
      for id in summary.batchIDs { try await client.undo(id) }
      summary.undone = true
      phase = .done(summary)
      await reload()
    } catch {
      actionError = text(error)
    }
  }

  /// Back to the list after a run.
  func doneViewing() {
    phase = .selecting
    selected = []
  }

  /// The Done view's follow-up: the senders just archived that can be unsubscribed from. The screen confirms first.
  var followUpSenders: [CleanupSender] {
    guard case .done(let summary) = phase, summary.kind == .archive, !summary.undone else { return [] }
    return summary.senders.filter(\.canUnsubscribe)
  }

  func unsubscribeArchived() {
    let senders = followUpSenders
    guard !senders.isEmpty else { return }
    phase = .selecting
    run(.unsubscribe, senders: senders)
  }

  private func finish(_ kind: CleanupKind, _ senders: [CleanupSender], _ result: CleanupLogic.RunResult) {
    task = nil
    pendingMail = result.confirm.map { ($0.sender, $0.mailTo) }
    let failures = result.failed.map { failure -> String in
      let name = failure.sender.name.isEmpty ? failure.sender.address : failure.sender.name
      return "Couldn’t update \(name)"
    }
    let links = result.openLinks.compactMap { URL(string: $0.url) }.compactMap { SafeHTML.openableURL($0) }
    let changed = result.done > 0 || !result.batchIds.isEmpty
    if !changed && result.confirm.isEmpty && !result.failed.isEmpty && links.isEmpty {
      let detail = result.failed.first.flatMap { failure -> String? in
        if case .error(let message) = failure.reason { return message }
        return nil
      }
      phase = .failed(
        kind, kind == .archive ? "Couldn’t archive. Nothing was moved." : (detail ?? "Couldn’t finish that."))
      return
    }
    phase = .done(
      Summary(
        kind: kind, senders: senders, done: result.done, batchIDs: result.batchIds, failures: failures,
        links: links))
    Task { await reload() }
  }

  private func text(_ error: Error) -> String {
    (error as? LocalizedError)?.errorDescription ?? "Something went wrong. Try again."
  }
}
