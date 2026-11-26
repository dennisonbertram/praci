import Foundation
import RakazoAPI

/// The message a compose sheet saves or sends. Optional fields are left out when nil.
struct ComposeDraft: Encodable, Sendable, Equatable {
  struct Forward: Encodable, Sendable, Equatable {
    let messageId: String
    let attachmentIds: [String]
  }

  let clientId: String
  let connectionId: String
  var replyToMessageId: String?
  var forwardOf: Forward?
  // swiftlint:disable:next identifier_name
  var to: String
  // swiftlint:disable:next identifier_name
  var cc: String
  var bcc: String
  var subject: String
  var body: String
}

enum ComposeMode: Sendable, Equatable {
  case new
  case reply(String)
  case replyAll(String)
  case forward(String)

  var messageID: String? {
    switch self {
    case .new: nil
    case .reply(let id), .replyAll(let id), .forward(let id): id
    }
  }
}

/// The compose operations. `live` calls the server; tests supply fakes.
struct ComposeClient {
  var prefill: @MainActor (_ mode: ComposeMode) async throws -> ComposePrefill
  var accounts: @MainActor () async throws -> [MailAccount]
  var save: @MainActor (_ draft: ComposeDraft) async throws -> ComposeOutcome
  var send: @MainActor (_ draft: ComposeDraft) async throws -> ComposeOutcome
  var discard: @MainActor (_ clientID: String) async throws -> Void
}

private struct DiscardInput: Encodable, Sendable { let clientId: String }

extension ComposeClient {
  @MainActor
  static func live(_ app: AppModel) -> ComposeClient {
    ComposeClient(
      prefill: { mode in
        let (id, name): (String, String) =
          switch mode {
          case .new: ("", "")
          case .reply(let id): (id, "reply")
          case .replyAll(let id): (id, "replyAll")
          case .forward(let id): (id, "forward")
          }
        return try await app.call(
          "inbox/compose/prefill", input: PrefillInput(messageId: id, mode: name), timeout: 30)
      },
      accounts: {
        let list: InboxList = try await app.call("inbox/list", input: [String: String]())
        return list.accounts.map { MailAccount(connectionId: $0.connectionId, label: $0.label, address: $0.address) }
      },
      save: { draft in
        let result: ComposeResult = try await app.call("inbox/compose/draftSave", input: draft, timeout: 30)
        return result.outcome
      },
      // A send may take a while at the mail provider. It is never retried by the app.
      send: { draft in
        let result: ComposeResult = try await app.call("inbox/compose/send", input: draft, timeout: 60)
        return result.outcome
      },
      discard: { id in
        let _: OKResult = try await app.call("inbox/compose/discard", input: DiscardInput(clientId: id))
      })
  }
}
