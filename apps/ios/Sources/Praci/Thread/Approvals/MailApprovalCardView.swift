import RakazoAPI
import SwiftUI

/// The mail an agent wants to save or send. The person can save the draft, send it, or discard
/// it; to change the text they tell the agent, which then asks again with a new draft.
struct MailApprovalCardView: View {
  let ask: AskBlock
  let mail: MailApproval
  let messageID: String
  let model: ThreadModel
  let approval: ApprovalModel
  @Environment(AppModel.self) private var app

  private var canAnswer: Bool { model.canAnswerAsk(messageID) }
  @State private var bodyExpanded = false
  private var interactive: Bool { !ask.isAnswered && approval.sentAnswer == nil && canAnswer }

  var body: some View {
    VStack(alignment: .leading, spacing: 10) {
      HStack(alignment: .firstTextBaseline) {
        Text(verbatim: mail.title.isEmpty ? String(localized: "No subject") : mail.title)
          .font(.subheadline.weight(.semibold)).lineLimit(2)
        Spacer(minLength: 8)
        status
      }
      row("To", mail.to)
      row("Cc", mail.cc)
      row("Bcc", mail.bcc)
      if !mail.body.isEmpty {
        Text(verbatim: mail.body).font(.subheadline).lineLimit(bodyExpanded ? nil : 10)
          .frame(maxWidth: .infinity, alignment: .leading)
        if mail.body.count > 400 || mail.body.split(separator: "\n").count > 10 {
          Button(bodyExpanded ? "Show less" : "Show more") { bodyExpanded.toggle() }
            .font(.footnote)
        }
      }
      if interactive { actions }
      if let reason = ask.approvalReason, interactive {
        Text(reason).font(.footnote).foregroundStyle(Color.token(.mutedForeground))
      }
    }
    .approvalCardChrome()
    .accessibilityElement(children: .contain)
    .accessibilityIdentifier("approvalCard")
  }

  @ViewBuilder private func row(_ label: LocalizedStringKey, _ people: [String]) -> some View {
    if !people.isEmpty {
      HStack(alignment: .firstTextBaseline, spacing: 8) {
        Text(label).foregroundStyle(Color.token(.mutedForeground)).frame(width: 28, alignment: .leading)
        Text(verbatim: people.joined(separator: ", "))
      }
      .font(.footnote)
    } else if label == "To", interactive, !mail.canSend {
      Text("Add a recipient").font(.footnote).foregroundStyle(Color.token(.warning))
    }
  }

  @ViewBuilder private var status: some View {
    switch finalStatus {
    case .needsApproval:
      Text("Needs approval").font(.caption.weight(.semibold))
        .padding(.horizontal, 8).padding(.vertical, 3)
        .foregroundStyle(Color.token(.warning))
        .background(Color.token(.warning).opacity(0.16), in: Capsule())
    case .inactive: Text("Not waiting for approval").font(.caption).foregroundStyle(Color.token(.mutedForeground))
    case .result(let text, let tone): ResolvedLine(text: text, tone: tone).font(.caption)
    }
  }

  private enum FinalStatus {
    case needsApproval, inactive
    case result(Text, ResolvedLine.Tone)
  }

  private var finalStatus: FinalStatus {
    let answer = ask.answer ?? approval.sentAnswer
    guard ask.isAnswered || approval.sentAnswer != nil else {
      return canAnswer ? .needsApproval : .inactive
    }
    switch mail.outcome {
    case "sent": return .result(Text("Sent"), .positive)
    case "saved": return .result(Text("Draft saved"), .positive)
    case "failed":
      return .result(mail.isDraftTool ? Text("Draft not saved") : Text("Not sent"), .negative)
    case "unknown": return .result(Text("Not confirmed"), .neutral)
    default: break
    }
    switch answer {
    case "superseded", "expired", "stopped": return .result(Text("Not sent"), .negative)
    case "skipped": return .result(Text("Skipped"), .neutral)
    case "deny": return .result(Text("Discarded"), .negative)
    default:
      return .result(mail.isDraftTool && ask.answer == "allow" ? Text("Saving…") : Text("Sending…"), .neutral)
    }
  }

  private var actions: some View {
    VStack(spacing: 8) {
      if mail.isDraftTool {
        CardActionButton(
          title: Text("Save"), style: mail.canSend ? .secondary : .prominent,
          busy: approval.pending == "save", disabled: approval.pending != nil,
          identifier: "mailSave"
        ) { Task { await answer("save", edits: nil) } }
      }
      if mail.canSend {
        CardActionButton(
          // The server's warning that this email just went out: Send stops being the obvious press.
          title: Text("Send"),
          style: ask.approvalReason == "Already sent to this person a few minutes ago" ? .secondary : .prominent,
          busy: approval.pending == "send",
          disabled: approval.pending != nil, identifier: "mailSend"
        ) {
          Task { await answer("send", edits: mail.isDraftTool ? MailAnswerEdits(send: true) : nil) }
        }
      }
      CardActionButton(
        title: Text("Discard"), style: .destructive, busy: approval.pending == "deny",
        disabled: approval.pending != nil, identifier: "mailDiscard"
      ) { Task { await answer("deny", edits: nil) } }
    }
  }

  /// "save" and "send" both answer `allow`; only send asks the server to send a draft.
  private func answer(_ action: String, edits: MailAnswerEdits?) async {
    let wire = action == "deny" ? "deny" : "allow"
    guard let runID = model.storedMessages.first(where: { $0.id == messageID })?.runId else { return }
    var input = ThreadAnswerInput(runId: runID, messageId: messageID, answer: wire, mail: edits)
    switch model.target {
    case .bot(let id): input.botId = id
    case .group(let id): input.groupId = id
    }
    let sent = input
    await approval.run(action, app: app, thread: model) {
      let _: JSONValue = try await app.call("threads/answer", input: sent)
    }
  }
}
