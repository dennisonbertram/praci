import RakazoAPI
import SwiftUI

/// Card for blocks that wait on, or record, a decision: ask (tool, mail, secret, plain), choice,
/// MCP server approval and app connection. The server keeps each card's state, so answered,
/// expired and replaced cards render read-only from the block itself.
struct ApprovalCardView: View {
  let block: MessageBlock
  let messageID: String
  let model: ThreadModel
  @State private var approval = ApprovalModel()
  @Environment(AppModel.self) private var app

  var body: some View {
    content
      .alert("Could not submit answer", isPresented: $approval.failed) {
        Button("OK", role: .cancel) {}
      } message: {
        Text(approval.failure ?? "")
      }
  }

  @ViewBuilder private var content: some View {
    switch block.kind {
    case .ask:
      if let ask = try? block.decodePayload(AskBlock.self) {
        AskCardView(ask: ask, messageID: messageID, model: model, approval: approval)
      }
    case .choice:
      if let choice = try? block.decodePayload(ChoiceBlock.self), !choice.isDismissed {
        ChoiceCardView(choice: choice, messageID: messageID, model: model, approval: approval)
      }
    case .mcpApproval:
      if let mcp = try? block.decodePayload(McpApprovalBlock.self) {
        McpApprovalCardView(mcp: mcp, messageID: messageID, model: model, approval: approval)
      }
    case .appConnect, .connect:
      if let connect = try? block.decodePayload(ConnectBlock.self) {
        ConnectCardView(connect: connect, model: model)
      }
    default:
      InfoCardView(block: block)
    }
  }
}

/// The plain `card` block: a heading and key/value lines.
private struct InfoCardView: View {
  let block: MessageBlock

  var body: some View {
    VStack(alignment: .leading, spacing: 6) {
      if let heading = block.question ?? block.text ?? block.title {
        Text(heading).font(.subheadline.weight(.semibold))
      }
      if let lines = block.cardLines {
        ForEach(Array(lines.enumerated()), id: \.offset) { _, line in
          HStack(alignment: .firstTextBaseline) {
            Text(line.k).foregroundStyle(Color.token(.mutedForeground))
            Spacer(minLength: 8)
            Text(line.v).multilineTextAlignment(.trailing)
          }
          .font(.footnote)
        }
      }
    }
    .approvalCardChrome()
    .accessibilityElement(children: .combine)
    .accessibilityIdentifier("approvalCard")
  }
}

extension View {
  /// The card surface shared by every approval card.
  func approvalCardChrome() -> some View {
    frame(maxWidth: .infinity, alignment: .leading)
      .padding(16)
      .background(Color.token(.card), in: RoundedRectangle(cornerRadius: 18))
      .overlay(RoundedRectangle(cornerRadius: 18).stroke(Color.token(.border)))
  }
}

/// One answered line: a mark and the outcome, e.g. "Allowed once".
struct ResolvedLine: View {
  enum Tone { case positive, negative, neutral }
  let text: Text
  let tone: Tone

  var body: some View {
    HStack(spacing: 6) {
      switch tone {
      case .positive: Image(systemName: "checkmark").foregroundStyle(Color.token(.success))
      case .negative: Image(systemName: "xmark").foregroundStyle(Color.token(.destructive))
      case .neutral: EmptyView()
      }
      text.foregroundStyle(
        tone == .neutral ? Color.token(.mutedForeground) : Color.token(.foreground))
    }
    .font(.subheadline.weight(.medium))
    .accessibilityIdentifier("approvalResolved")
  }
}

/// A full-width capsule button, prominent only for the one preferred answer.
struct CardActionButton: View {
  enum Style { case prominent, secondary, destructive }
  let title: Text
  let style: Style
  let busy: Bool
  let disabled: Bool
  let identifier: String
  let action: () -> Void

  private var labelColor: Color {
    switch style {
    case .prominent: Color.token(.primaryForeground)
    case .secondary: Color.token(.foreground)
    case .destructive: Color.token(.destructive)
    }
  }

  var body: some View {
    Button(action: action) {
      ZStack {
        title.foregroundStyle(labelColor).opacity(busy ? 0 : 1)
        if busy { ProgressView() }
      }
      .frame(maxWidth: .infinity, minHeight: 28)
    }
    .buttonBorderShape(.capsule)
    .controlSize(.large)
    .modifier(CardButtonStyle(style: style))
    .disabled(disabled || busy)
    .accessibilityIdentifier(identifier)
  }
}

private struct CardButtonStyle: ViewModifier {
  let style: CardActionButton.Style

  func body(content: Content) -> some View {
    switch style {
    case .prominent:
      content.buttonStyle(.borderedProminent).tint(Color.token(.primary))
    case .secondary:
      content.buttonStyle(.bordered).tint(Color.token(.secondary))
    case .destructive:
      content.buttonStyle(.bordered).tint(Color.token(.secondary))
    }
  }
}
