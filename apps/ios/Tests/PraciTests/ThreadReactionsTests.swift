import RakazoAPI
import Testing

@testable import Praci

struct ThreadReactionsTests {
  private func reaction(_ id: String, _ emoji: String, to parent: String) -> ThreadMessage {
    ThreadMessage(
      id: id, role: "user", blocks: [MessageBlock(kind: .text, fields: ["text": .string(emoji)])],
      replyToMessageId: parent)
  }

  @Test func groupsReactionsUnderTheirTargetAndCountsRepeats() {
    let messages = [
      ThreadMessage(id: "a"), reaction("r1", "👍", to: "a"), reaction("r2", "❤️", to: "a"),
      reaction("r3", "👍", to: "a"),
    ]
    let result = ThreadReactions.project(messages)
    #expect(result.visible.map(\.id) == ["a"])
    #expect(
      result.reactions["a"] == [ReactionCount(emoji: "👍", count: 2), ReactionCount(emoji: "❤️", count: 1)])
  }

  @Test func keepsAReactionWhoseTargetIsNotLoadedAndOrdinaryReplies() {
    let plain = ThreadMessage(
      id: "p", role: "user", blocks: [MessageBlock(kind: .text, fields: ["text": .string("thanks")])],
      replyToMessageId: "a")
    let messages = [ThreadMessage(id: "a"), reaction("orphan", "🎉", to: "gone"), plain]
    let result = ThreadReactions.project(messages)
    #expect(result.visible.map(\.id) == ["a", "orphan", "p"])
    #expect(result.reactions.isEmpty)
  }
}
