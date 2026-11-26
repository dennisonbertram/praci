import Foundation
import Observation
import RakazoAPI

extension Notification.Name {
  /// Posted with the message id (as the object) after the message screen archives a message.
  static let inboxMessageArchived = Notification.Name("praci.inboxMessageArchived")
}

@MainActor
@Observable
final class InboxMessageModel {
  /// What the Unsubscribe menu item last did.
  enum UnsubscribeOutcome: Equatable {
    case done, sent, unknown, unavailable
    case opened(URL)
    case confirmMail(String)
    case failed(String)
  }

  let messageID: String
  private(set) var state: Loadable<MailMessage> = .idle
  private(set) var archived = false
  private(set) var isAsking = false
  var actionError: String?
  var unsubscribe: UnsubscribeOutcome?
  var previewURL: URL?
  var notice: String?

  @ObservationIgnored private let client: InboxMessageClient

  init(messageID: String, client: InboxMessageClient) {
    self.messageID = messageID
    self.client = client
  }

  var message: MailMessage? { state.value }

  /// "Name <a@x.test>" parsed; nil when the sender has no usable address.
  var sender: MailAddress? { message.flatMap { MailAddresses.parse($0.from) } }

  func load() async {
    if case .loaded = state { return }
    await reload()
  }

  func reload() async {
    state = .loading
    do {
      let message = try await client.get(messageID)
      state = .loaded(message)
      // The server does not mark a message read when it is fetched, so opening it has to say so.
      if message.unread { try? await client.markRead(messageID) }
    } catch {
      state = .failed(text(error))
    }
  }

  func archive() async {
    do {
      try await client.archive(messageID)
      archived = true
    } catch {
      actionError = text(error)
    }
  }

  func undoArchive() async {
    do {
      try await client.unarchive(messageID)
      archived = false
    } catch {
      actionError = text(error)
    }
  }

  /// The Inbox agent bot to open, with this message as context. One tap, one call.
  func askAgent() async -> String? {
    guard !isAsking else { return nil }
    isAsking = true
    defer { isAsking = false }
    do {
      return try await client.askAgent(messageID).id
    } catch {
      actionError = text(error)
      return nil
    }
  }

  func unsubscribeFromSender(confirmMailto: Bool = false) async {
    guard let sender else {
      unsubscribe = .unavailable
      return
    }
    do {
      let connectionID = try await client.connection(messageID)
      let result = try await client.unsubscribe(connectionID, sender.address, confirmMailto)
      unsubscribe = unsubscribeOutcome(result, senderAddress: sender.address)
    } catch {
      unsubscribe = .failed(text(error))
    }
  }

  private func unsubscribeOutcome(_ result: UnsubscribeResult, senderAddress: String) -> UnsubscribeOutcome {
    switch result.status {
    case "done": return .done
    case "sent": return .sent
    case "unknown": return .unknown
    case "opened":
      return result.openUrl.flatMap(URL.init(string:)).flatMap { SafeHTML.openableURL($0) }
        .map(UnsubscribeOutcome.opened) ?? .unavailable
    case "needs_confirmation": return .confirmMail(result.mailTo ?? senderAddress)
    case "disabled": return .failed("Changing mail is turned off.")
    case "refused": return .failed("The sender didn’t accept that.")
    case "failed": return .failed("Couldn’t unsubscribe.")
    default: return .unavailable
    }
  }

  func openAttachment(_ attachment: MailAttachment) async {
    do {
      previewURL = try await client.attachment(messageID, attachment)
    } catch {
      actionError = text(error)
    }
  }

  private func text(_ error: Error) -> String {
    (error as? LocalizedError)?.errorDescription ?? "Something went wrong. Try again."
  }
}
