// swiftlint:disable identifier_name
import Foundation
import RakazoAPI

/// The Inbox list operations. `live` calls the server; tests supply fakes.
struct InboxClient {
  var list: @MainActor (_ connectionId: String?, _ query: String?, _ pageToken: String?) async throws -> InboxList
  var refresh: @MainActor () async throws -> InboxRefresh
  var markRead: @MainActor (_ messageID: String, _ read: Bool) async throws -> Void
  var archive: @MainActor (_ messageID: String) async throws -> Void
  var unarchive: @MainActor (_ messageID: String) async throws -> Void
  var spam: @MainActor (_ messageID: String) async throws -> InboxMoveResult
  var undoBatch: @MainActor (_ batchID: String) async throws -> InboxUndoResult
}

private struct RefreshInput: Encodable, Sendable { let waitMs: Int }
private struct MarkReadInput: Encodable, Sendable { let messageId: String, read: Bool }
private struct MessageInput: Encodable, Sendable { let messageId: String }
private struct MoveInput: Encodable, Sendable { let op: String, messageIds: [String] }
private struct UndoInput: Encodable, Sendable { let batchId: String }

extension InboxClient {
  @MainActor
  static func live(_ app: AppModel) -> InboxClient {
    InboxClient(
      list: { connectionID, query, pageToken in
        var input: [String: String] = [:]
        if let connectionID { input["connectionId"] = connectionID }
        if let query, !query.isEmpty { input["query"] = query }
        if let pageToken { input["pageToken"] = pageToken }
        return try await app.call("inbox/list", input: input)
      },
      // Refresh can wait out a rate-limit backoff and then sync, well over the 8 s default.
      refresh: { try await app.call("inbox/refresh", input: RefreshInput(waitMs: 8_000), timeout: 90) },
      markRead: { id, read in
        let _: RPCOk = try await app.call("inbox/markRead", input: MarkReadInput(messageId: id, read: read))
      },
      archive: { id in
        let _: RPCOk = try await app.call("inbox/archive", input: MessageInput(messageId: id))
      },
      unarchive: { id in
        let _: RPCOk = try await app.call("inbox/unarchive", input: MessageInput(messageId: id))
      },
      spam: { id in
        try await app.call("inbox/moveMany", input: MoveInput(op: "spam", messageIds: [id]))
      },
      undoBatch: { id in
        try await app.call("inbox/actions/undo", input: UndoInput(batchId: id))
      })
  }
}

private struct RPCOk: Decodable, Sendable { let ok: Bool }
