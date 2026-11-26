import Foundation
import RakazoAPI

/// The operations of the message screen. `live` calls the server; tests supply fakes.
struct InboxMessageClient {
  var get: @MainActor (_ messageID: String) async throws -> MailMessage
  var markRead: @MainActor (_ messageID: String) async throws -> Void
  var archive: @MainActor (_ messageID: String) async throws -> Void
  var unarchive: @MainActor (_ messageID: String) async throws -> Void
  var askAgent: @MainActor (_ messageID: String) async throws -> AskAgentResult
  /// The account a message arrived on. rpc_inbox_get does not say, but the reply prefill does.
  var connection: @MainActor (_ messageID: String) async throws -> String
  var unsubscribe:
    @MainActor (_ connectionID: String, _ address: String, _ confirmMailto: Bool) async throws
      -> UnsubscribeResult
  var attachment: @MainActor (_ messageID: String, _ attachment: MailAttachment) async throws -> URL
}

private struct MessageInput: Encodable, Sendable { let messageId: String }
private struct MarkReadInput: Encodable, Sendable { let messageId: String, read: Bool }
private struct UnsubscribeInput: Encodable, Sendable {
  let connectionId: String, address: String
  let confirmMailto: Bool?
}
struct PrefillInput: Encodable, Sendable {
  let messageId: String, mode: String
  var timeZone = TimeZone.current.identifier
  var locale = Locale.current.identifier(.bcp47)
}

extension InboxMessageClient {
  @MainActor
  static func live(_ app: AppModel) -> InboxMessageClient {
    InboxMessageClient(
      get: { id in try await app.call("inbox/get", input: MessageInput(messageId: id)) },
      markRead: { id in
        let _: OKResult = try await app.call("inbox/markRead", input: MarkReadInput(messageId: id, read: true))
      },
      archive: { id in
        let _: OKResult = try await app.call("inbox/archive", input: MessageInput(messageId: id))
      },
      unarchive: { id in
        let _: OKResult = try await app.call("inbox/unarchive", input: MessageInput(messageId: id))
      },
      askAgent: { id in try await app.call("inbox/askAgent", input: MessageInput(messageId: id), timeout: 30) },
      connection: { id in
        let prefill: ComposePrefill = try await app.call(
          "inbox/compose/prefill", input: PrefillInput(messageId: id, mode: "reply"), timeout: 30)
        return prefill.connectionId
      },
      unsubscribe: { connection, address, confirm in
        try await app.call(
          "inbox/unsubscribe",
          input: UnsubscribeInput(connectionId: connection, address: address, confirmMailto: confirm ? true : nil),
          timeout: 30)
      },
      attachment: { id, attachment in
        let base = app.authentication.endpoint
        let path = "/api/inbox/messages/\(id.urlPathSafe)/attachments/\(attachment.id.urlPathSafe)"
        guard let url = URL(string: path, relativeTo: base)?.absoluteURL else { throw URLError(.badURL) }
        let data = try await app.data(url: url)
        let directory = FileManager.default.temporaryDirectory
          .appending(path: "mail-attachments", directoryHint: .isDirectory)
        try FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true)
        let name = attachment.filename.replacing("/", with: "-")
        let file = directory.appending(path: "\(attachment.id)-\(name.isEmpty ? "attachment" : name)")
        try data.write(to: file, options: .atomic)
        return file
      })
  }
}

extension String {
  fileprivate var urlPathSafe: String {
    addingPercentEncoding(withAllowedCharacters: .alphanumerics.union(CharacterSet(charactersIn: "-._~"))) ?? self
  }
}
