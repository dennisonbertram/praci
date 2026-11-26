import RakazoAPI
import RakazoCore
import SwiftUI
import UIKit

private struct ReactInput: Encodable, Sendable {
  var botId: String?
  var groupId: String?
  var messageId: String
  var reaction: String
  var clientNonce: String
}

/// Menu items for one message: copy, reply and the six reactions. "Mark unread" is added by the row.
struct MessageActions: View {
  let message: ThreadMessage
  let model: ThreadModel
  @Environment(AppModel.self) private var app

  static let reactions = ["👍", "👎", "❤️", "😂", "🎉", "😮"]
  private static let names = ["Like", "Dislike", "Love", "Laugh", "Celebrate", "Surprised"]

  var body: some View {
    let text = message.blocks.compactMap(\.text).joined(separator: "\n\n")
    if !text.isEmpty {
      Button { UIPasteboard.general.string = text } label: {
        Label("Copy", systemImage: "doc.on.doc")
      }
    }
    if isStoredMessage(id: message.id) {
      Button { reply(text) } label: { Label("Reply", systemImage: "arrowshape.turn.up.left") }
      if message.role != "user" {
        // A palette ControlGroup draws text emoji as "?" placeholders, so the six go in a submenu.
        Menu {
          ForEach(Array(Self.reactions.enumerated()), id: \.offset) { index, emoji in
            Button("\(Self.names[index]) \(emoji)") { Task { await react(emoji) } }
          }
        } label: {
          Label("React", systemImage: "face.smiling")
        }
      }
    }
  }

  private func reply(_ text: String) {
    let author =
      message.role == "user" ? "yourself" : (model.memberName(message.botId) ?? model.title)
    let quote = text.isEmpty ? "Attachment" : String(text.prefix(200))
    model.composer.reply = ReplyTarget(messageID: message.id, author: author, quote: quote)
  }

  private func react(_ emoji: String) async {
    var input = ReactInput(
      messageId: message.id, reaction: emoji, clientNonce: UUID().uuidString)
    switch model.target {
    case .bot(let id): input.botId = id
    case .group(let id): input.groupId = id
    }
    do {
      try await app.consent.ensure(procedure: "threads/react", app: app)
      let _: JSONValue = try await app.call("threads/react", input: input)
    } catch {
      model.composer.notice = "Couldn’t react. Try again."
    }
  }
}
