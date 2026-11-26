import Foundation
import Observation
import RakazoAPI
import RakazoCore

/// What one card is doing: which action is in flight and the last failure. The server owns the
/// card's state, so after every answer (and after a CONFLICT) the thread is read again.
@MainActor
@Observable
final class ApprovalModel {
  /// The id of the action being sent; every other action is disabled meanwhile.
  var pending: String?
  var failure: String?
  /// The answer this device sent, shown until the refreshed thread carries the card's own state.
  var sentAnswer: String?

  var failed: Bool {
    get { failure != nil }
    set { if !newValue { failure = nil } }
  }

  /// Shown for a failed secret answer: a server message may echo what was submitted.
  static let secretFailure = String(localized: "Couldn’t save the credential. Try again.")

  static func failureMessage(_ error: any Error, secret: Bool) -> String {
    secret ? secretFailure : error.localizedDescription
  }

  /// Runs one request for the card. `work` must not retain a secret beyond its own call.
  func run(
    _ id: String, secret: Bool = false, app: AppModel, thread: ThreadModel,
    work: () async throws -> Void
  ) async {
    guard pending == nil else { return }
    pending = id
    defer { pending = nil }
    do {
      try await work()
      sentAnswer = id
      failure = nil
      await thread.refresh(app)
    } catch RPCError.server(let code, _, _) where code.uppercased() == "CONFLICT" {
      // Someone else (another device) answered first: show the card's new state, no error.
      sentAnswer = nil
      await thread.refresh(app)
    } catch {
      failure = Self.failureMessage(error, secret: secret)
    }
  }

  /// `id` names the action for the busy state and `sentAnswer`; a typed answer or a secret must
  /// pass a fixed id here so its text is never kept.
  func answer(
    _ answer: String, id: String? = nil, secret: Bool = false, username: String? = nil, mail: MailAnswerEdits? = nil,
    messageID: String, app: AppModel, thread: ThreadModel
  ) async {
    guard let runID = thread.storedMessages.first(where: { $0.id == messageID })?.runId else {
      failure = String(localized: "This request is no longer active.")
      return
    }
    var input = ThreadAnswerInput(
      runId: runID, messageId: messageID, answer: answer, username: username, mail: mail)
    switch thread.target {
    case .bot(let id): input.botId = id
    case .group(let id): input.groupId = id
    }
    let sent = input
    await run(id ?? answer, secret: secret, app: app, thread: thread) {
      let _: JSONValue = try await app.call("threads/answer", input: sent)
    }
  }
}

extension ThreadModel {
  /// The agent that owns a card: the message's author, or the thread's agent.
  func cardBotID(_ messageID: String) -> String? {
    if let id = storedMessages.first(where: { $0.id == messageID })?.botId { return id }
    if case .bot(let id) = target { return id }
    return nil
  }

  func canAnswerAsk(_ messageID: String) -> Bool {
    guard let snapshot else { return false }
    return answerableAskMessageID(
      messages: snapshot.messages, run: snapshot.run, activeRuns: snapshot.activeRuns) == messageID
  }
}
