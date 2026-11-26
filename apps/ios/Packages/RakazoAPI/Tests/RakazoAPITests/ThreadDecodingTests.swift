import Foundation
@testable import RakazoAPI
import Testing

@Test
func decodesRecordedBotThread() throws {
  let thread = try JSONDecoder().decode(
    RPCEnvelope<ThreadSnapshot>.self, from: loadFixture(named: "thread-get-bot")
  ).json
  #expect(thread.cursor == 1)
  #expect(thread.lastReadSeq == -1)
  #expect(thread.olderCursor == nil)
  #expect(thread.run == nil)
  #expect(thread.botId == "id-placeholder-4")
  #expect(thread.computer?.state == "running")
  #expect(thread.computer?.busyBotName == nil)
  #expect(thread.messages.count == 8)
  #expect(thread.messages[0].role == "user")
  #expect(thread.messages[1].botId == thread.botId)
  let kinds = thread.messages[1].blocks.map(\.kind)
  #expect(kinds == [.text, .steps])
  #expect(thread.messages.contains { $0.blocks.contains { $0.kind == .card } })
}

@Test
func decodesRecordedGroupThread() throws {
  let thread = try JSONDecoder().decode(
    RPCEnvelope<ThreadSnapshot>.self, from: loadFixture(named: "thread-get-group")
  ).json
  #expect(thread.cursor == -1)
  #expect(thread.groupName == "Group placeholder")
  #expect(thread.members?.map(\.status) == ["idle", "waiting_input"])
  #expect(thread.activeRuns == [])
  #expect(thread.messages.count == 8)
}

@Test
func decodesRecordedMessagePage() throws {
  let page = try JSONDecoder().decode(
    RPCEnvelope<ThreadMessagePage>.self, from: loadFixture(named: "thread-messages")
  ).json
  #expect(page.messages.count == 4)
  #expect(page.olderCursor == nil)
  #expect(page.coveredThroughSeq == nil)
}

@Test
func toleratesRunsReplyPreviewsAndUnknownValues() throws {
  let thread = try JSONDecoder().decode(
    RPCEnvelope<ThreadSnapshot>.self, from: loadFixture(named: "thread-get-running")
  ).json
  #expect(thread.run?.status == "running")
  #expect(thread.run?.trigger == "a-future-trigger")
  #expect(thread.run?.phase?.kind == "thinking")
  #expect(thread.delegatePendingAgents?.first?.name == "Helper")
  let message = try #require(thread.messages.first)
  #expect(message.blocks.first?.kind == .unknown("a_future_block"))
  #expect(message.replyPreview?.attachment?.artifactId == "artifact-placeholder")
  #expect(message.replyToMessageId == "message-two")
}

@Test
func messageWithMissingOptionalFieldsStillDecodes() throws {
  let data = Data(#"{"id":"m1","blocks":[{"kind":"text","text":"hi"}]}"#.utf8)
  let message = try JSONDecoder().decode(ThreadMessage.self, from: data)
  #expect(message.id == "m1")
  #expect(message.role == "bot")
  #expect(message.blocks.first?.text == "hi")
}

@Test
func decodesPageCardBlock() throws {
  let data = Data(
    #"{"kind":"page","botId":"b1","pageId":"p1","title":"Customer support"}"#.utf8)
  let block = try JSONDecoder().decode(MessageBlock.self, from: data)
  #expect(block.kind == .page)
  #expect(block.title == "Customer support")
  #expect(block.fields["botId"]?.stringValue == "b1")
  #expect(block.fields["pageId"]?.stringValue == "p1")
}

/// An older client has no reply batch card: it shows the plain card with Discard, and cannot send.
@Test
func decodesReplyBatchAskAsAPlainCardWithDiscardOnly() throws {
  let json = #"""
    {"kind":"ask","text":"2 replies","detail":"a@example.test: Re: one\nb@example.test: Re: two",
     "approvalEffectId":"effect-1","status":"pending",
     "mailBatch":{"count":2,"sent":0,"failed":0,"unknown":0},
     "actions":[{"id":"deny","label":"Discard"}]}
    """#
  let ask = try JSONDecoder().decode(AskBlock.self, from: Data(json.utf8))
  #expect(ask.text == "2 replies")
  #expect(ask.detail?.contains("a@example.test") == true)
  #expect(ask.actions.map(\.id) == ["deny"])
  #expect(!ask.isMail)
  #expect(ask.outcome == nil)
  let pressed = json.replacingOccurrences(
    of: #""status":"pending""#, with: #""status":"answered","answer":"send""#)
  let answered = try JSONDecoder().decode(AskBlock.self, from: Data(pressed.utf8))
  #expect(answered.outcome == .answered(nil))
}

@Test
func decodesGoalOnSnapshotAndGoalBlock() throws {
  let snapshot = try JSONDecoder().decode(
    ThreadSnapshot.self,
    from: Data(
      #"{"threadId":"t","cursor":3,"messages":[],"olderCursor":null,"run":null,"goal":{"id":"g","text":"Find three suppliers","status":"active","stopReason":null,"lastReason":null,"continuations":0,"startedAt":"2026-01-01T00:00:00.000Z"}}"#
        .utf8))
  #expect(snapshot.goal?.text == "Find three suppliers")
  #expect(snapshot.goal?.status == "active")
  let none = try JSONDecoder().decode(
    ThreadSnapshot.self, from: Data(#"{"threadId":"t","cursor":3,"goal":null}"#.utf8))
  #expect(none.goal == nil)
  let block = try JSONDecoder().decode(
    MessageBlock.self,
    from: Data(#"{"kind":"goal","outcome":"met","reason":"All found.","text":"Goal met. All found."}"#.utf8))
  #expect(block.kind == .goal)
  #expect(block.fields["outcome"]?.stringValue == "met")
}
