import Foundation
import Observation
import RakazoAPI
import RakazoCore

@MainActor
@Observable
final class ComposeModel {
  /// What the last save or send said, shown above the fields.
  enum Banner: Equatable {
    case notSent(String)
    /// The send may have gone out. Never retried; the user checks Sent.
    case unknown
    case reconnect
    case disabled(String)
    case error(String)
  }

  private(set) var state: Loadable<Void> = .idle
  private(set) var accounts: [MailAccount] = []
  private(set) var attachments: [MailAttachment] = []
  private(set) var isSending = false
  private(set) var isSaving = false
  private(set) var banner: Banner?
  private(set) var sent = false
  private(set) var savedDraft = false
  var connectionID = ""
  // swiftlint:disable:next identifier_name
  var to = ""
  // swiftlint:disable:next identifier_name
  var cc = ""
  var bcc = ""
  var subject = ""
  var body = ""
  /// The quoted original of a reply, kept out of the editable body and appended when sending.
  private(set) var quote = ""
  var showsCcBcc = false

  let mode: ComposeMode
  /// One id for the life of the sheet: the server treats a repeated send with the same id as the same message.
  let clientID: String

  @ObservationIgnored private let client: ComposeClient
  @ObservationIgnored private var replyToMessageID: String?
  @ObservationIgnored private var initial: Snapshot?

  private struct Snapshot: Equatable {
    // swiftlint:disable:next identifier_name
    var to, cc, bcc, subject, body: String
    var connectionID: String
    var attachmentIDs: [String]
  }

  init(mode: ComposeMode, client: ComposeClient, clientID: String = UUID().uuidString) {
    self.mode = mode
    self.client = client
    self.clientID = clientID
  }

  var title: String {
    switch mode {
    case .new: "New message"
    case .reply, .replyAll: "Reply"
    case .forward: "Forward"
    }
  }

  var account: MailAccount? { accounts.first { $0.connectionId == connectionID } }

  func load() async {
    guard case .idle = state else { return }
    state = .loading
    do {
      if let id = mode.messageID {
        let prefill = try await client.prefill(mode)
        connectionID = prefill.connectionId
        accounts = prefill.account.map { [$0] } ?? []
        to = prefill.to
        cc = prefill.cc
        subject = prefill.subject
        if mode.isForward {
          body = prefill.body
        } else {
          quote = prefill.body.trimmingCharacters(in: .whitespacesAndNewlines)
        }
        attachments = prefill.attachments
        showsCcBcc = !prefill.cc.isEmpty
        replyToMessageID = mode.isForward ? nil : (prefill.replyToMessageId ?? id)
        if prefill.attachmentsTooLarge {
          let names = prefill.attachmentsLeftOut.map(\.filename).joined(separator: ", ")
          banner = .error("Some files were left out: \(names).")
        }
      } else {
        accounts = try await client.accounts()
        connectionID = accounts.first?.connectionId ?? ""
        if connectionID.isEmpty { throw ComposeError.noAccount }
      }
      initial = snapshot
      state = .loaded(())
    } catch {
      state = .failed(text(error))
    }
  }

  private var snapshot: Snapshot {
    Snapshot(
      to: to, cc: cc, bcc: bcc, subject: subject, body: body, connectionID: connectionID,
      attachmentIDs: attachments.map(\.id))
  }

  /// True once anything changed from what the sheet opened with.
  var hasChanges: Bool { initial.map { $0 != snapshot } ?? false }

  func removeAttachment(_ id: String) { attachments.removeAll { $0.id == id } }

  var invalidRecipients: [String] {
    MailAddresses.invalid(in: to) + MailAddresses.invalid(in: cc) + MailAddresses.invalid(in: bcc)
  }

  var toError: Bool { !MailAddresses.invalid(in: to).isEmpty }

  /// Send needs a recipient and only valid addresses. After an `unknown` result or a sent message it stays off.
  var canSend: Bool {
    guard case .loaded = state, !isSending, !sent, banner != .unknown else { return false }
    return !MailAddresses.split(to).isEmpty && invalidRecipients.isEmpty
  }

  private var draft: ComposeDraft {
    ComposeDraft(
      clientId: clientID, connectionId: connectionID, replyToMessageId: replyToMessageID,
      forwardOf: mode.forwardID.map { ComposeDraft.Forward(messageId: $0, attachmentIds: attachments.map(\.id)) },
      to: to, cc: cc, bcc: bcc, subject: subject, body: fullBody)
  }

  /// What is sent: the typed text, then the quoted original after a blank line.
  var fullBody: String { quote.isEmpty ? body : body + "\n\n" + quote }

  /// Returns true when the message went out and the sheet can close.
  func send() async -> Bool {
    guard canSend else { return false }
    isSending = true
    banner = nil
    defer { isSending = false }
    do {
      apply(try await client.send(draft), sending: true)
    } catch let error as RPCError {
      // A server error means it refused the request, so nothing was sent.
      banner = .notSent(text(error))
    } catch {
      // A dropped connection or timeout: the request may have reached the server.
      banner = .unknown
    }
    return sent
  }

  /// Keeps the draft on the server. Returns true when it was saved.
  func saveDraft() async -> Bool {
    isSaving = true
    defer { isSaving = false }
    do {
      let outcome = try await client.save(draft)
      if outcome == .saved { savedDraft = true; return true }
      apply(outcome, sending: false)
    } catch {
      banner = .error(text(error))
    }
    return false
  }

  /// Drops a draft saved earlier. Nothing to do when none was saved.
  func discard() async {
    guard savedDraft else { return }
    try? await client.discard(clientID)
    savedDraft = false
  }

  private func apply(_ outcome: ComposeOutcome, sending: Bool) {
    switch outcome {
    case .sent: sent = true
    case .saved: banner = nil
    case .unknown: banner = .unknown
    case .reconnect: banner = .reconnect
    case .disabled: banner = .disabled(account?.address ?? account?.label ?? "this account")
    case .failed(let reason):
      switch reason {
      case "rate_limited": banner = .notSent("Not sent. Gmail is limiting requests. Try again in a moment.")
      case "rejected": banner = .notSent("Not sent. Gmail rejected the message. Check the addresses.")
      default: banner = .notSent("Not sent. Try again.")
      }
    case .unrecognized: banner = .error("The server returned an answer this app does not know.")
    }
  }

  private func text(_ error: Error) -> String {
    (error as? LocalizedError)?.errorDescription ?? "Something went wrong. Try again."
  }
}

private enum ComposeError: LocalizedError {
  case noAccount
  var errorDescription: String? { "Connect a mail account to write a message." }
}

extension ComposeMode {
  fileprivate var isForward: Bool { if case .forward = self { true } else { false } }
  fileprivate var forwardID: String? { if case .forward(let id) = self { id } else { nil } }
}
