import CryptoKit
import Foundation
import Observation
import RakazoAPI
import RakazoCore

private struct UploadInput: Encodable, Sendable {
  var botId: String?
  var groupId: String?
  var name: String
  var mimeType: String
  var contentBase64: String
  var clientNonce: String
}

private struct UploadResult: Decodable, Sendable { var id: String }

private struct SendInput: Encodable, Sendable {
  var botId: String?
  var groupId: String?
  var text: String
  var artifactIds: [String]
  var replyToMessageId: String?
  var replyQuote: String?
  var clientNonce: String
}

private struct SendResult: Decodable, Sendable { var seq: Int }

/// Unsent messages for every thread: sends them in order, keeps them on disk, and reports what
/// happened to each. A send that cannot reach the server stays queued and is tried again.
@MainActor
@Observable
final class SendQueue {
  static let shared = SendQueue()

  private(set) var attempts: [SendAttempt] = []
  /// Accepted sends, shown until the live thread catches up to their sequence number.
  private(set) var accepted: [SendAttempt] = []
  /// A status line the server answered a command with (`/goal`), by thread key. Not an error.
  var notices: [String: String] = [:]
  /// True while the last try could not reach the server.
  private(set) var offline = false

  @ObservationIgnored private let root: URL
  @ObservationIgnored private var disk: OutboxDisk
  @ObservationIgnored private var scope: OutboxScope?
  @ObservationIgnored private var confirming: Task<Void, Never>?
  @ObservationIgnored private var drainTask: Task<Void, Never>?
  @ObservationIgnored private let retryDelay: Duration

  init(
    directory: URL = OutboxDisk.standardRoot(),
    retryDelay: Duration = .seconds(5)
  ) {
    root = directory
    disk = OutboxDisk(directory: directory)
    self.retryDelay = retryDelay
  }

  func pending(thread key: String) -> [SendAttempt] {
    attempts.filter { $0.payload.originThreadKey == key }
  }

  func echoes(thread key: String, cursor: Int) -> [SendAttempt] {
    accepted.filter { $0.payload.originThreadKey == key && ($0.acceptedSeq ?? 0) > cursor }
  }

  /// Loads what an earlier launch left for this server, user and space, then drains. Each scope
  /// has its own folder, so another account never reads or sends these messages. Until the
  /// server confirms who is signed in, nothing is sent.
  func bind(_ app: AppModel) {
    rescope(app)
    if !app.userConfirmed, confirming == nil {
      confirming = Task { [weak self, retryDelay] in
        while !Task.isCancelled {
          await app.confirmUser()
          if app.userConfirmed { break }
          try? await Task.sleep(for: retryDelay)
        }
        guard !Task.isCancelled else { return }
        self?.confirming = nil
        self?.rescope(app)
        self?.kick(app)
      }
    }
    kick(app)
  }

  /// Sign-out, server change or user change: drop the queue from memory and stop sending.
  func unbind() {
    confirming?.cancel()
    confirming = nil
    drainTask?.cancel()
    drainTask = nil
    scope = nil
    attempts = []
    accepted = []
    notices = [:]
    offline = false
  }

  private func currentScope(_ app: AppModel) -> OutboxScope? {
    guard let user = app.userID else { return nil }
    return OutboxScope(
      apiBase: app.authentication.endpoint.absoluteString, userID: user, cacheSession: "ios",
      spaceID: app.spaceID)
  }

  private func rescope(_ app: AppModel) {
    let next = currentScope(app)
    guard next != scope else { return }
    unbind()
    scope = next
    guard let next else { return }
    var digest = SHA256()
    digest.update(data: Data("\(next.apiBase)\n\(next.userID)\n\(next.spaceID ?? "")".utf8))
    let name = digest.finalize().map { String(format: "%02x", $0) }.joined()
    disk = OutboxDisk(directory: root.appendingPathComponent(name, isDirectory: true))
    attempts = disk.load(session: 0, scope: next)
  }

  /// Adds a send. Returns an error message when it cannot be kept (disk full or unwritable).
  func enqueue(_ payload: SendPayload, _ app: AppModel) -> String? {
    bind(app)
    guard let scope else { return "Couldn’t save the message. Try again." }
    var attempt = SendAttempt(
      clientNonce: UUID().uuidString, payload: payload, scope: scope, session: 0)
    let tooMany = "Too many unsent messages. Try again later."
    if attempts.count >= OutboxLimits.maxEntries { return tooMany }
    do {
      guard try disk.admit(&attempt) else { return tooMany }
      try disk.save(attempts + [attempt])
    } catch {
      disk.forget(attempt)
      return "Couldn’t save the message on this device."
    }
    attempts.append(attempt)
    kick(app)
    return nil
  }

  func retry(_ nonce: String, _ app: AppModel) {
    update(nonce) { $0.state = .queued; $0.error = nil }
    kick(app)
  }

  func delete(_ nonce: String) {
    guard let attempt = attempts.first(where: { $0.clientNonce == nonce }) else { return }
    attempts.removeAll { $0.clientNonce == nonce }
    disk.forget(attempt)
    try? disk.save(attempts)
  }

  func kick(_ app: AppModel) {
    guard drainTask == nil, app.userConfirmed, scope == currentScope(app) else { return }
    drainTask = Task { [weak self] in
      await self?.drain(app)
      if !Task.isCancelled { self?.drainTask = nil }
    }
  }

  // MARK: Delivery

  private func drain(_ app: AppModel) async {
    while !Task.isCancelled, scope == currentScope(app), let next = attempts.first(where: { $0.state == .queued }) {
      let outcome = await deliver(next.clientNonce, app)
      offline = outcome?.pausesQueue == true
      if outcome?.pausesQueue == true { try? await Task.sleep(for: retryDelay) }
    }
  }

  /// Returns nil when the server accepted the message.
  private func deliver(_ nonce: String, _ app: AppModel) async -> SendOutcome? {
    update(nonce) { $0.state = .pending }
    guard var attempt = attempts.first(where: { $0.clientNonce == nonce }) else { return nil }
    do {
      try await app.consent.ensure(procedure: "threads/send", app: app)
      try disk.hydrate(&attempt)
      var ids: [String] = []
      for (index, file) in attempt.payload.attachments.enumerated() {
        if let known = attempt.artifactIDs[file.id] { ids.append(known); continue }
        let created: UploadResult = try await app.call(
          "artifacts/create", input: Self.upload(attempt, file, index), timeout: 60)
        update(nonce) { $0.artifactIDs[file.id] = created.id }
        attempt.artifactIDs[file.id] = created.id
        ids.append(created.id)
      }
      let result: SendResult = try await app.call(
        "threads/send", input: Self.sendInput(attempt, ids))
      accept(nonce, seq: result.seq)
      return nil
    } catch RPCError.goalReply(let message) {
      // The server handled the command and sent no message: show its answer and drop the draft.
      notices[attempt.payload.originThreadKey] = message
      attempts.removeAll { $0.clientNonce == nonce }
      disk.forget(attempt)
      try? disk.save(attempts)
      return nil
    } catch {
      let (outcome, message) = Self.outcome(for: error)
      update(nonce) { $0.state = outcome.state; $0.error = message }
      try? disk.save(attempts)
      return outcome
    }
  }

  private func accept(_ nonce: String, seq: Int) {
    guard var done = attempts.first(where: { $0.clientNonce == nonce }) else { return }
    attempts.removeAll { $0.clientNonce == nonce }
    disk.forget(done)
    try? disk.save(attempts)
    done.acceptedSeq = seq
    accepted = Array((accepted + [done]).suffix(5))
  }

  private func update(_ nonce: String, _ change: (inout SendAttempt) -> Void) {
    guard let index = attempts.firstIndex(where: { $0.clientNonce == nonce }) else { return }
    change(&attempts[index])
  }

  private static func upload(_ attempt: SendAttempt, _ file: OutboxAttachment, _ index: Int)
    -> UploadInput
  {
    UploadInput(
      botId: attempt.payload.botTarget, groupId: attempt.payload.groupTarget, name: file.name,
      mimeType: file.mimeType, contentBase64: file.data.base64EncodedString(),
      clientNonce: "\(attempt.clientNonce)-\(index)")
  }

  private static func sendInput(_ attempt: SendAttempt, _ ids: [String]) -> SendInput {
    SendInput(
      botId: attempt.payload.botTarget, groupId: attempt.payload.groupTarget,
      text: attempt.payload.displayText, artifactIds: ids,
      replyToMessageId: attempt.payload.replyTargetID, replyQuote: attempt.payload.replyQuote,
      clientNonce: attempt.clientNonce)
  }

  /// Maps a failed call to the state the message goes to, plus the text to show for it.
  static func outcome(for error: any Error) -> (SendOutcome, String?) {
    switch error {
    case RPCError.server(_, let status, let message):
      return (.classify(status: status, unreachable: false), message)
    case RPCError.notSupported:
      return (.classify(status: 404, unreachable: false), error.localizedDescription)
    case RPCError.unauthorized, RPCError.stale:
      return (.classify(status: nil, unreachable: true), nil)
    case let blocked as AIConsentBlocked:
      if blocked.underlying is URLError { return (.classify(status: nil, unreachable: true), nil) }
      return (.classify(status: nil, unreachable: false), blocked.message)
    case is URLError:
      return (.classify(status: nil, unreachable: true), nil)
    default:
      return (.classify(status: nil, unreachable: false), error.localizedDescription)
    }
  }
}
