import Foundation
import Observation
import RakazoAPI

/// Why the list cannot be trusted right now, from the accounts the last list reported.
enum InboxProblem: Equatable {
  case reconnect, rateLimited, unreachable
}

enum InboxActionError: LocalizedError {
  case rejected(reason: String)

  var errorDescription: String? {
    switch self {
    case .rejected(let reason):
      reason == "reconnect" ? "Reconnect Gmail to do that." : "Couldn’t move that message."
    }
  }
}

@MainActor
@Observable
final class InboxModel {
  /// What Undo does. Archive has no batch, so it is undone by unarchiving the message.
  enum Undo: Equatable {
    case unarchive(messageID: String)
    case batch(id: String)
    /// A plain confirmation with no Undo.
    case note(String)
  }

  struct Toast: Equatable, Identifiable {
    let id = UUID()
    let undo: Undo
  }

  private(set) var state: Loadable<InboxList> = .idle
  private(set) var isSyncing = false
  private(set) var isLoadingMore = false
  private(set) var toast: Toast?
  var actionError: String?
  var query = ""
  private(set) var connectionID: String?

  @ObservationIgnored private let client: InboxClient
  /// Rows this list archived, so Undo can show one again before the server answers.
  @ObservationIgnored private var archivedRows: [String: (row: InboxRow, index: Int)] = [:]
  @ObservationIgnored private var generation = 0

  init(client: InboxClient) { self.client = client }

  var list: InboxList? { state.value }
  var rows: [InboxRow] { list?.rows ?? [] }

  var problem: InboxProblem? {
    guard let list else { return nil }
    if !list.reconnectAccounts.isEmpty { return .reconnect }
    if !list.rateLimitedAccounts.isEmpty { return .rateLimited }
    return list.failedAccounts.isEmpty ? nil : .unreachable
  }

  /// First open: show the list, then sync the mailbox once and show what arrived.
  func start() async {
    guard case .idle = state else { return }
    state = .loading
    await reload()
    await sync()
  }

  func pullToRefresh() async { await sync() }

  func retry() async {
    if list == nil { state = .loading }
    await reload()
    await sync()
  }

  func select(account id: String?) async {
    guard id != connectionID else { return }
    connectionID = id
    await reload()
  }

  func search() async { await reload() }

  func loadMoreIfNeeded(after row: InboxRow) async {
    guard let list, row.id == list.rows.last?.id, let token = list.nextPageToken, !isLoadingMore
    else { return }
    isLoadingMore = true
    defer { isLoadingMore = false }
    let started = generation
    guard let page = try? await client.list(connectionID, query, token), started == generation
    else { return }
    update {
      let known = Set($0.rows.map(\.id))
      $0.rows += page.rows.filter { !known.contains($0.id) }
      $0.nextPageToken = page.nextPageToken
    }
  }

  func archive(_ row: InboxRow) async {
    if let index = rows.firstIndex(where: { $0.id == row.id }) { archivedRows[row.id] = (row, index) }
    await remove(row) {
      try await client.archive(row.id)
      return Toast(undo: .unarchive(messageID: row.id))
    }
  }

  func markSpam(_ row: InboxRow) async {
    await remove(row) {
      let result = try await client.spam(row.id)
      if let failure = result.failed.first { throw InboxActionError.rejected(reason: failure.reason) }
      return Toast(undo: .batch(id: result.batchId))
    }
  }

  func setRead(_ row: InboxRow, read: Bool) async {
    setUnread(row.id, !read)
    do {
      try await client.markRead(row.id, read)
    } catch {
      setUnread(row.id, row.unread)
      actionError = message(for: error)
    }
  }

  /// Opening a row marks it read on screen; the message screen tells the server.
  func didOpen(_ row: InboxRow) { setUnread(row.id, false) }

  func undo(_ toast: Toast) async {
    self.toast = nil
    var shown: String?
    do {
      switch toast.undo {
      case .unarchive(let id):
        if let saved = archivedRows.removeValue(forKey: id), !rows.contains(where: { $0.id == id }) {
          update { $0.rows.insert(saved.row, at: min(saved.index, $0.rows.count)) }
          shown = id
        }
        try await client.unarchive(id)
      case .batch(let id): _ = try await client.undoBatch(id)
      case .note: return
      }
      await reload()
    } catch {
      if let shown { update { $0.rows.removeAll { $0.id == shown } } }
      actionError = message(for: error)
    }
  }

  /// The message screen archived this message: take it off the list and offer Undo here.
  func archivedElsewhere(_ id: String) {
    update { $0.rows.removeAll { $0.id == id } }
    toast = Toast(undo: .unarchive(messageID: id))
  }

  func show(_ text: String) { toast = Toast(undo: .note(text)) }

  /// Coming back to the list: pick up what changed on the message screen.
  func refreshOnReturn() async {
    guard case .loaded = state else { return }
    await reload()
  }

  func dismissToast(_ id: UUID) {
    if toast?.id == id { toast = nil }
  }

  // MARK: - Private

  /// Takes the row off the list at once; a failure puts it back and says why.
  private func remove(_ row: InboxRow, _ action: () async throws -> Toast) async {
    guard let index = rows.firstIndex(where: { $0.id == row.id }) else { return }
    update { $0.rows.remove(at: index) }
    do {
      toast = try await action()
    } catch {
      update { $0.rows.insert(row, at: min(index, $0.rows.count)) }
      actionError = message(for: error)
    }
  }

  private func setUnread(_ id: String, _ unread: Bool) {
    update { list in
      if let index = list.rows.firstIndex(where: { $0.id == id }) { list.rows[index].unread = unread }
    }
  }

  private func reload() async {
    generation += 1
    let mine = generation
    do {
      let fresh = try await client.list(connectionID, query, nil)
      guard mine == generation else { return }
      state = .loaded(fresh)
    } catch {
      guard mine == generation else { return }
      // A list already on screen stays; a failed first load shows the error.
      if list == nil { state = .failed(message(for: error)) }
    }
  }

  private func sync() async {
    guard !isSyncing, list != nil else { return }
    isSyncing = true
    defer { isSyncing = false }
    _ = try? await client.refresh()
    await reload()
  }

  private func update(_ change: (inout InboxList) -> Void) {
    guard case .loaded(var list) = state else { return }
    change(&list)
    state = .loaded(list)
  }

  private func message(for error: Error) -> String {
    (error as? LocalizedError)?.errorDescription ?? "Something went wrong. Try again."
  }
}
