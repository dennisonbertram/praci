import Foundation
import RakazoAPI
@testable import RakazoCore
import Testing

// Ported from packages/core/src/thread-message-updates.test.ts (same case names).

private func cloud(_ agentId: String) -> MessageBlock {
  block(
    "cloud_agent",
    [
      "agentId": .string(agentId), "title": .string("Agent"), "status": .string("running"),
      "url": .string(""),
    ]
  )
}

@Test("takes only the matching run and drops obsolete unscoped progress in order")
func takesMatchingRun() {
  let messages = [
    ThreadMessage(id: "first"),
    ThreadMessage(id: "progress:legacy"),
    ThreadMessage(id: "progress:current", runId: "current"),
    ThreadMessage(id: "progress:other", runId: "other"),
    ThreadMessage(id: "last"),
  ]
  let result = takeLiveMessage(messages, liveID: "progress:current")
  #expect(result.previous == messages[2])
  #expect(result.remaining == [messages[0], messages[3], messages[4]])
  #expect(messages.count == 5)
}

@Test("updates every matching cloud block while preserving metadata and unrelated messages")
func updatesCloudBlocks() {
  let messages = [
    ThreadMessage(id: "first", blocks: [cloud("agent"), cloud("other")], replyToMessageId: "reply"),
    ThreadMessage(id: "second", blocks: [cloud("agent")], replyToMessageId: "reply"),
    ThreadMessage(id: "third", blocks: [textBlock("unchanged")], replyToMessageId: "reply"),
  ]
  let result = updateCloudAgentMessages(
    messages,
    payload: ["messageId": .string("first"), "agentId": .string("agent"), "status": .string("finished")]
  )
  #expect(result.map(\.id) == ["first", "second", "third"])
  #expect(result[0].replyToMessageId == "reply")
  #expect(result[0].blocks[0].fields["status"] == .string("finished"))
  #expect(result[0].blocks[0].fields["agentId"] == .string("agent"))
  #expect(result[1].blocks[0].fields["status"] == .string("finished"))
  #expect(result[0].blocks[1] == messages[0].blocks[1])
  #expect(result[2] == messages[2])
  #expect(messages[0].blocks[0].fields["status"] == .string("running"))
}

@Test("cloud agent links must be https without credentials")
func cloudURLs() {
  #expect(cloudAgentHTTPSURL("https://example.test/a") == "https://example.test/a")
  #expect(cloudAgentHTTPSURL("http://example.test/a") == nil)
  #expect(cloudAgentHTTPSURL("https://user:pw@example.test/a") == nil)
  #expect(cloudAgentHTTPSURL("not a url") == nil)
  #expect(cloudAgentHTTPSURL(nil) == nil)
}
