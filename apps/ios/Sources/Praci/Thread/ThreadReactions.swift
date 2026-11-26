import RakazoAPI

/// An emoji and how many times it was used on one message.
struct ReactionCount: Equatable {
  var emoji: String
  var count: Int
}

/// Emoji-only user replies are reactions: the thread hides them and shows a small row under the
/// message they answer. Mirrors `projectMessageReactions` in the web transcript.
enum ThreadReactions {
  static let allowed: Set<String> = ["👍", "👎", "❤️", "😂", "🎉", "😮"]

  static func emoji(of message: ThreadMessage) -> String? {
    guard message.role == "user", message.replyToMessageId != nil, message.blocks.count == 1,
      message.blocks[0].kind == .text, let text = message.blocks[0].text
    else { return nil }
    return allowed.contains(text) ? text : nil
  }

  /// A reaction whose target is not in `messages` stays an ordinary bubble so it can be opened.
  static func project(_ messages: [ThreadMessage]) -> (
    visible: [ThreadMessage], reactions: [String: [ReactionCount]]
  ) {
    let byID = Dictionary(messages.map { ($0.id, $0) }, uniquingKeysWith: { first, _ in first })
    var reactions: [String: [ReactionCount]] = [:]
    let visible = messages.filter { message in
      guard let emoji = emoji(of: message), let parentID = message.replyToMessageId,
        let parent = byID[parentID], parentID != message.id, Self.emoji(of: parent) == nil
      else { return true }
      var counts = reactions[parentID, default: []]
      if let index = counts.firstIndex(where: { $0.emoji == emoji }) {
        counts[index].count += 1
      } else {
        counts.append(ReactionCount(emoji: emoji, count: 1))
      }
      reactions[parentID] = counts
      return false
    }
    return (visible, reactions)
  }
}
