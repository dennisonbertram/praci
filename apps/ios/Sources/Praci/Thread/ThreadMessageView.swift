import RakazoAPI
import RakazoCore
import SwiftUI

struct ThreadMessageView: View {
  let message: ThreadMessage
  let model: ThreadModel
  var reactions: [ReactionCount] = []
  /// The sender's name and avatar are drawn only in group threads, on a sender's first message.
  let showsSender: Bool
  let showsTime: Bool

  var body: some View {
    VStack(alignment: message.role == "user" ? .trailing : .leading, spacing: 4) {
      if showsSender, message.role != "user", case .group = model.target {
        HStack(spacing: 6) {
          BotAvatarView(
            name: model.memberName(message.botId) ?? "", avatar: model.memberColor(message.botId),
            size: 24)
          Text(model.memberName(message.botId) ?? "").font(.footnote.weight(.semibold))
            .foregroundStyle(Color.token(.mutedForeground))
        }
      }
      if let quote = message.replyPreview?.text ?? message.replyQuote, !quote.isEmpty {
        Text(quote).font(.footnote).lineLimit(2)
          .foregroundStyle(Color.token(.mutedForeground))
          .padding(.leading, 8)
          .overlay(alignment: .leading) { Rectangle().fill(Color.token(.border)).frame(width: 2) }
      }
      ForEach(Array(message.blocks.enumerated()), id: \.offset) { _, block in
        blockView(block)
      }
      if !reactions.isEmpty { reactionRow }
      if showsTime, !message.createdAt.isEmpty, isStoredMessage(id: message.id) {
        Text(rowTimestamp(message.createdAt)).font(.caption).monospacedDigit()
          .foregroundStyle(Color.token(.mutedForeground))
      }
    }
    .frame(maxWidth: .infinity, alignment: message.role == "user" ? .trailing : .leading)
    .padding(.leading, message.role == "user" ? 48 : 0)
    .padding(.trailing, message.role == "user" ? 0 : 16)
    .contextMenu {
      MessageActions(message: message, model: model)
      if isStoredMessage(id: message.id) {
        MarkUnreadButton(messageID: message.id, model: model)
      }
    }
    .accessibilityIdentifier("threadMessage")
  }

  private var reactionRow: some View {
    HStack(spacing: 4) {
      ForEach(reactions, id: \.emoji) { reaction in
        Text(reaction.count > 1 ? "\(reaction.emoji) \(reaction.count)" : reaction.emoji)
          .font(.caption)
          .padding(.horizontal, 8).padding(.vertical, 2)
          .background(Color.token(.muted), in: Capsule())
          .overlay(Capsule().stroke(Color.token(.border)))
      }
    }
    .accessibilityElement(children: .combine)
    .accessibilityIdentifier("messageReactions")
  }

  // One case per block kind.
  // swiftlint:disable:next cyclomatic_complexity
  @ViewBuilder private func blockView(_ block: MessageBlock) -> some View {
    switch block.kind {
    case .text:
      if let text = block.text, !text.isEmpty { bubble(text) }
    case .progress:
      if let text = block.text, !text.isEmpty {
        if block.fields["activity"] == .bool(true) {
          ToolLabel(title: text, running: true)
        } else {
          bubble(text)
        }
      }
    case .steps: StepsBlockView(block: block)
    case .subagent: SubagentRowView(block: block)
    case .page: PageCardView(block: block)
    case .goal: GoalBlockView(block: block)
    case .image: ImageBlockView(block: block)
    case .file: FileBlockView(block: block)
    case .ask, .choice, .mcpApproval, .appConnect, .connect, .card:
      ApprovalCardView(block: block, messageID: message.id, model: model)
    default:
      // Notes (`meta`) and kinds this version cannot draw: show their text, or nothing.
      if let text = block.text, !text.isEmpty {
        Text(verbatim: text).font(.footnote).foregroundStyle(Color.token(.mutedForeground))
      }
    }
  }

  @ViewBuilder private func bubble(_ text: String) -> some View {
    if message.role == "user" {
      Text(inlineMarkdown(text))
        .foregroundStyle(Color.token(.chatUserForeground))
        .padding(.horizontal, 16).padding(.vertical, 10)
        .background(Color.token(.chatUser), in: RoundedRectangle(cornerRadius: 20))
    } else {
      MarkdownView(text: text)
        .padding(.horizontal, 16).padding(.vertical, 10)
        .background(Color.token(.muted), in: RoundedRectangle(cornerRadius: 20))
    }
  }
}

private struct MarkUnreadButton: View {
  let messageID: String
  let model: ThreadModel
  @Environment(AppModel.self) private var app

  var body: some View {
    Button { Task { await model.markUnread(messageID, app) } } label: {
      Label("Mark unread", systemImage: "circle.fill")
    }
  }
}

/// "Name is working" with the bot's mark and three pulsing dots.
struct WorkingIndicator: View {
  let name: String
  let avatar: String?
  @Environment(\.accessibilityReduceMotion) private var reduceMotion

  var body: some View {
    HStack(spacing: 10) {
      BotAvatarView(name: name, avatar: avatar, size: 28)
      HStack(spacing: 4) {
        ForEach(0..<3, id: \.self) { index in
          Circle().fill(Color.token(.mutedForeground)).frame(width: 6, height: 6)
            .phaseAnimator([0.4, 1.0]) { view, opacity in
              view.opacity(reduceMotion ? 0.6 : opacity)
            } animation: { _ in reduceMotion ? nil : .easeInOut(duration: 0.6).delay(Double(index) * 0.15) }
        }
      }
      .padding(.horizontal, 12).padding(.vertical, 10)
      .background(Color.token(.muted), in: Capsule())
      Text("\(name) is working").font(.footnote).foregroundStyle(Color.token(.mutedForeground))
    }
    .accessibilityElement(children: .combine)
    .accessibilityLabel("\(name) is working")
    .accessibilityIdentifier("workingIndicator")
  }
}
