import Foundation
import Testing

@testable import RakazoAPI

private func decode<T: Decodable>(_ type: T.Type, _ name: String) throws -> T {
  try JSONDecoder().decode(RPCEnvelope<T>.self, from: loadFixture(named: name)).json
}

@Test
func decodesTheRecordedInboxList() throws {
  let list = try decode(InboxList.self, "inbox-list")
  #expect(list.rows.count == 6)
  #expect(list.accounts.count == 2)
  #expect(list.accounts[0].label == "Founder mail")
  #expect(list.agent?.name == "Inbox agent")
  #expect(list.enabled == false)
  #expect(list.syncedAt != nil)
  #expect(list.nextPageToken == nil)  // the server sends null here
  #expect(list.triageBlocked?.reason == "needs_consent")
  let first = list.rows[0]
  #expect(first.unread && first.inInbox)
  #expect(first.needsReply == nil && first.category == nil)
  #expect(first.pile == "important")
  #expect(first.fromAddress == "priya@quill-capital.example.test")
}

@Test
func decodesTheReconnectAndRateLimitedStates() throws {
  let reconnect = try decode(InboxList.self, "inbox-list-reconnect")
  #expect(reconnect.rows.isEmpty)
  #expect(reconnect.reconnectAccounts.count == 1)
  #expect(reconnect.failedAccounts == reconnect.reconnectAccounts)
  #expect(reconnect.syncedAt == nil)
  #expect(reconnect.accounts[0].address == nil)

  let limited = try decode(InboxList.self, "inbox-list-rate-limited")
  #expect(limited.rateLimitedAccounts.count == 1)
  #expect(limited.reconnectAccounts.isEmpty)
}

@Test
func toleratesMissingNullAndUnknownFields() throws {
  let json = """
    {"json":{"accounts":null,"rows":[{"id":"m1","connectionId":"c1","from":"A","subject":"S",
    "receivedAt":"2026-10-29T01:26:42Z","unread":false,"category":"a-future-category","futureField":1}],
    "rateLimitedAccounts":null,"nextPageToken":"next-1"}}
    """
  let list = try JSONDecoder().decode(RPCEnvelope<InboxList>.self, from: Data(json.utf8)).json
  #expect(list.accounts.isEmpty && list.enabled == false)
  #expect(list.rateLimitedAccounts.isEmpty && list.reconnectAccounts.isEmpty)
  #expect(list.nextPageToken == "next-1")
  #expect(list.rows[0].category == "a-future-category")
  #expect(list.rows[0].snippet == "")
}

@Test
func decodesRefreshAndTheMoveAndUndoResults() throws {
  let refresh = try decode(InboxRefresh.self, "inbox-refresh")
  #expect(refresh.ok && refresh.syncing == true && refresh.failedAccounts.isEmpty)
  let move = try JSONDecoder().decode(
    RPCEnvelope<InboxMoveResult>.self,
    from: Data(#"{"json":{"done":["m1"],"failed":[{"messageId":"m2","reason":"reconnect"}],"batchId":"b1"}}"#.utf8)
  ).json
  #expect(move.done == ["m1"] && move.failed.first?.reason == "reconnect" && move.batchId == "b1")
  let undo = try JSONDecoder().decode(
    RPCEnvelope<InboxUndoResult>.self, from: Data(#"{"json":{"restored":1,"failed":0}}"#.utf8)
  ).json
  #expect(undo.restored == 1 && undo.failed == 0)
}
