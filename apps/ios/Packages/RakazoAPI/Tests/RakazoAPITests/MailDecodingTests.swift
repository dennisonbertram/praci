import Foundation
import Testing

@testable import RakazoAPI

private func decode<T: Decodable>(_ type: T.Type, _ name: String) throws -> T {
  try JSONDecoder().decode(RPCEnvelope<T>.self, from: loadFixture(named: name)).json
}

@Test
func decodesTheRecordedMessage() throws {
  let message = try decode(MailMessage.self, "mail-get")
  #expect(message.subject.hasPrefix("Re: [MOCK] Redlines"))
  #expect(message.html == nil)  // the server sends null
  #expect(message.text?.hasPrefix("Maya, if section 9") == true)
  #expect(message.thread.count == 3)
  #expect(message.thread[1].fromSelf)
  #expect(message.later.isEmpty)
  #expect(message.replyAllDiffers && message.unread)
  let attached = try decode(MailMessage.self, "mail-get-attachment")
  #expect(attached.attachments.first?.mimeType == "application/pdf")
}

@Test
func decodesThePrefill() throws {
  let prefill = try decode(ComposePrefill.self, "mail-prefill-reply")
  #expect(prefill.account?.label == "Founder mail")
  #expect(prefill.to.contains("morgan@halcyon-logistics.example.test"))
  #expect(prefill.body.contains("> Maya, if section 9"))
  #expect(prefill.replyToMessageId != nil)
  #expect(prefill.quoteUnavailable == false)
}

@Test
func mapsEverySendOutcome() throws {
  #expect(try decode(ComposeResult.self, "mail-send-sent").outcome == .sent)
  #expect(try decode(ComposeResult.self, "mail-send-unknown").outcome == .unknown)
  #expect(try decode(ComposeResult.self, "mail-send-failed").outcome == .failed(reason: "rejected"))
  let other = try JSONDecoder().decode(
    RPCEnvelope<ComposeResult>.self, from: Data(#"{"json":{"status":"later"}}"#.utf8))
  #expect(other.json.outcome == .unrecognized("later"))
}

@Test
func decodesCleanupAndTodos() throws {
  let empty = try decode(CleanupList.self, "mail-cleanup-list-empty")
  #expect(empty.senders.isEmpty && empty.accounts.count == 2)
  let list = try decode(CleanupList.self, "mail-cleanup-list")
  #expect(list.senders.count == 2)
  #expect(list.senders[0].canUnsubscribe && !list.senders[1].canUnsubscribe)
  #expect(list.senders[1].lastReceivedAt == nil && list.senders[1].unsubscribeStatus == "failed")
  let todos = try decode(MailTodoList.self, "mail-todos")
  #expect(todos.enabled && todos.todos.count == 2)
  #expect(todos.todos[0].messageId == "msg-1" && todos.todos[1].messageId == nil)
  #expect(try decode(MailTodoList.self, "mail-todos-disabled").enabled == false)
  #expect(try decode(CleanupArchiveResult.self, "mail-cleanup-archive").remaining == 8)
  let opened = try decode(UnsubscribeResult.self, "mail-unsubscribe-opened")
  #expect(opened.openUrl == "https://example.test/unsubscribe")
}

@Test
func parsesAndValidatesAddresses() {
  #expect(
    MailAddresses.parse("Ana Ruiz <ana@example.test>")
      == MailAddress(name: "Ana Ruiz", address: "ana@example.test"))
  #expect(MailAddresses.parse("\"Ruiz, Ana\" <ana@example.test>")?.name == "Ruiz, Ana")
  #expect(MailAddresses.parse("ana@example.test")?.name == nil)
  #expect(MailAddresses.parse("ana@@example") == nil)
  #expect(MailAddresses.parse("ana@example") == nil)
  #expect(MailAddresses.split("\"Ruiz, Ana\" <a@x.test>, b@y.test; c@z.test").count == 3)
  #expect(MailAddresses.invalid(in: "a@x.test, nope").map { $0 } == ["nope"])
  #expect(MailAddresses.invalid(in: "  ").isEmpty)
}

private func sender(
  _ address: String, count: Int = 10, read: Int = 0, spam: Bool = false, unsub: String = "link"
) -> CleanupSender {
  CleanupSender(
    connectionId: "c", address: address, messageCount: count, readCount: read, inboxThreads: count,
    spamLike: spam, unsubscribe: unsub)
}

@Test
func cleanupTargetsAndRanking() {
  let first = sender("a@x.test", count: 5, read: 4)
  let second = sender("b@x.test", count: 10, spam: true, unsub: "none")
  let third = sender("c@x.test", count: 7)
  let senders = [first, second, third]
  #expect(CleanupLogic.rank(senders).map(\.address) == ["b@x.test", "c@x.test", "a@x.test"])
  let all = Set(senders.map(\.id))
  #expect(CleanupLogic.targets(.archive, senders: senders, selected: all).count == 3)
  let skipInbox = CleanupLogic.targets(.skipInbox, senders: senders, selected: all)
  #expect(skipInbox.map(\.address) == ["a@x.test", "c@x.test"])
  let unsubscribe = CleanupLogic.targets(.unsubscribe, senders: senders, selected: all)
  #expect(unsubscribe.map(\.address) == ["a@x.test", "c@x.test"])
  #expect(CleanupLogic.threadCount([first, third]) == 12)
}

private actor Calls {
  var archive: [String] = []
  var unsub = 0
  func recordArchive(_ address: String) { archive.append(address) }
  func recordUnsub() { unsub += 1 }
}

@Test
func cleanupPagesUntilEmptyAndNeverArchivesAfterUnknownUnsubscribe() async {
  let calls = Calls()
  let api = CleanupLogic.Api(
    archive: { kind, sender, batch in
      await calls.recordArchive("\(kind.rawValue):\(sender.address):\(batch ?? "-")")
      let logged = await calls.archive
      let pages = logged.filter { $0.contains(sender.address) }.count
      return try decodeArchive(done: 40, remaining: pages < 2 ? 5 : 0)
    },
    unsubscribe: { sender, _ in
      await calls.recordUnsub()
      return UnsubscribeResult(status: sender.address == "u@x.test" ? "unknown" : "done")
    })
  let result = await CleanupLogic.run(.unsubscribe, senders: [sender("u@x.test"), sender("d@x.test")], api: api)
  #expect(result.failed.map(\.reason) == [.unknown])
  let logged = await calls.archive
  #expect(logged == ["unsubscribe:d@x.test:-", "unsubscribe:d@x.test:b"])
  #expect(result.done == 80 && result.batchIds == ["b"])
  let archived = await CleanupLogic.run(.archive, senders: [sender("e@x.test")], api: api)
  let unsubs = await calls.unsub
  #expect(archived.failed.isEmpty && unsubs == 2)
}

@Test
func cleanupKeepsFailuresAndAsksBeforeMail() async {
  let api = CleanupLogic.Api(
    archive: { _, _, _ in throw URLError(.notConnectedToInternet) },
    unsubscribe: { _, confirm in
      UnsubscribeResult(status: confirm ? "sent" : "needs_confirmation", mailTo: "unsub@x.test")
    })
  let ask = await CleanupLogic.run(.unsubscribe, senders: [sender("m@x.test", unsub: "mailto")], api: api)
  #expect(ask.confirm.first?.mailTo == "unsub@x.test" && ask.failed.isEmpty)
  let sent = await CleanupLogic.run(
    .unsubscribe, senders: [sender("m@x.test", unsub: "mailto")], api: api, confirmMailto: true)
  #expect(sent.failed.count == 1)  // the archive step failed after the email was sent
}

private func decodeArchive(done: Int, remaining: Int) throws -> CleanupArchiveResult {
  let json = #"{"batchId":"b","done":\#(done),"failed":0,"remaining":\#(remaining)}"#
  return try JSONDecoder().decode(CleanupArchiveResult.self, from: Data(json.utf8))
}
