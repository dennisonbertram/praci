import RakazoAPI
import SwiftUI

/// An `ask` block: a tool approval (allow, always, deny), a mail approval, a secret request, a
/// question with answer buttons, or a free-text question.
struct AskCardView: View {
  let ask: AskBlock
  let messageID: String
  let model: ThreadModel
  let approval: ApprovalModel
  @Environment(AppModel.self) private var app

  private var canAnswer: Bool { model.canAnswerAsk(messageID) }

  var body: some View {
    if ask.isMail, let mail = ask.mail {
      MailApprovalCardView(
        ask: ask, mail: mail, messageID: messageID, model: model, approval: approval)
    } else if ask.isSecret {
      SecretAskView(ask: ask, messageID: messageID, model: model, approval: approval)
    } else {
      standardCard
    }
  }

  private var standardCard: some View {
    VStack(alignment: .leading, spacing: 12) {
      Text(ask.text).font(.body.weight(.semibold))
      if let detail = ask.detail, !detail.isEmpty { DetailWell(text: detail, folded: ask.detailFolded) }
      footer
      if let reason = ask.approvalReason {
        Text(reason).font(.footnote).foregroundStyle(Color.token(.mutedForeground))
      }
    }
    .approvalCardChrome()
    .accessibilityElement(children: .contain)
    .accessibilityIdentifier("approvalCard")
  }

  @ViewBuilder private var footer: some View {
    if let outcome = ask.outcome {
      ResolvedLine(text: AskOutcomeText.text(outcome), tone: AskOutcomeText.tone(outcome))
    } else if let sent = approval.sentAnswer, approval.pending == nil {
      // The answer went through; the refreshed block has not arrived yet.
      ResolvedLine(text: AskOutcomeText.sentText(sent), tone: AskOutcomeText.sentTone(sent))
    } else if !canAnswer {
      Text("No longer active").font(.footnote).foregroundStyle(Color.token(.mutedForeground))
    } else if ask.actions.isEmpty {
      FreeTextAnswer(messageID: messageID, model: model, approval: approval)
    } else {
      VStack(spacing: 8) {
        if ask.isApproval && ask.actions.contains(where: {
          $0.id == "always" && $0.label != "Always for this agent"
        }) {
          Text("Won't ask again anywhere in this space.")
            .font(.footnote)
            .foregroundStyle(Color.token(.mutedForeground))
            .frame(maxWidth: .infinity, alignment: .leading)
        }
        ForEach(ask.actions, id: \.id) { action in
          CardActionButton(
            title: AskOutcomeText.label(for: action, in: ask),
            style: style(of: action),
            busy: approval.pending == action.id,
            disabled: approval.pending != nil,
            identifier: "approvalAction.\(action.id)"
          ) {
            Task { await approval.answer(action.id, messageID: messageID, app: app, thread: model) }
          }
        }
      }
    }
  }

  private func style(of action: AskAction) -> CardActionButton.Style {
    guard ask.isApproval else { return .secondary }
    switch action.id {
    case "allow": return .prominent
    case "deny": return .destructive
    default: return .secondary
    }
  }
}

/// Raw tool arguments in an inset well, in full, or behind a "Details" disclosure.
private struct DetailWell: View {
  let text: String
  let folded: Bool

  var body: some View {
    if folded {
      DisclosureGroup("Details") { well }
        .font(.footnote)
    } else {
      well
    }
  }

  private var well: some View {
    Text(text)
      .font(.footnote.monospaced())
      .frame(maxWidth: .infinity, alignment: .leading)
      .padding(10)
      .background(Color.token(.muted), in: RoundedRectangle(cornerRadius: 12))
  }
}

private struct FreeTextAnswer: View {
  let messageID: String
  let model: ThreadModel
  let approval: ApprovalModel
  @State private var text = ""
  @Environment(AppModel.self) private var app

  var body: some View {
    VStack(spacing: 8) {
      TextField("Type your answer", text: $text, axis: .vertical)
        .textFieldStyle(.roundedBorder)
        .disabled(approval.pending != nil)
        .accessibilityIdentifier("askAnswerField")
      CardActionButton(
        title: Text("Send answer"), style: .prominent, busy: approval.pending != nil,
        disabled: text.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty,
        identifier: "askSend"
      ) {
        let answer = text.trimmingCharacters(in: .whitespacesAndNewlines)
        Task { await approval.answer(answer, id: "text", messageID: messageID, app: app, thread: model) }
      }
    }
  }
}

/// Words for answers and outcomes. Kept here so every card reads the same.
enum AskOutcomeText {
  // swiftlint:disable:next cyclomatic_complexity
  static func text(_ outcome: AskOutcome) -> Text {
    switch outcome {
    case .allowedOnce: Text("Allowed once")
    case .alwaysAllowed: Text("Always allowed")
    case .alwaysAllowedForRoutine: Text("Always allowed for this routine")
    case .alwaysAllowedForSites: Text("Allowed for all sites")
    case .denied: Text("Denied")
    case .approved: Text("Approved")
    case .approvedWaiting(let service): Text("Approved here. Waiting for \(service)")
    case .allowed: Text("Allowed")
    case .notNow: Text("Not now")
    case .shared: Text("Shared")
    case .notShared: Text("Not shared")
    case .created: Text("Created")
    case .cancelled: Text("Cancelled")
    case .superseded: Text("Replaced by a newer request")
    case .expired: Text("Expired")
    case .stopped: Text("Stopped")
    case .skipped: Text("Skipped")
    case .saved: Text("Saved")
    case .answered(let label?): Text("Answered: \(label)")
    case .answered(nil): Text("Answered")
    }
  }

  static func tone(_ outcome: AskOutcome) -> ResolvedLine.Tone {
    switch outcome {
    case .allowedOnce, .alwaysAllowed, .alwaysAllowedForRoutine, .alwaysAllowedForSites, .approved, .approvedWaiting, .allowed, .shared, .saved, .created:
      .positive
    case .denied, .notNow, .notShared: .negative
    default: .neutral
    }
  }

  /// The line for an answer this device just sent.
  static func sentText(_ answer: String) -> Text {
    switch answer {
    case "allow": text(.allowedOnce)
    case "always": text(.alwaysAllowed)
    case "always_routine": text(.alwaysAllowedForRoutine)
    case "always_bot_sites": text(.alwaysAllowedForSites)
    case "deny": text(.denied)
    default: text(.answered(nil))
    }
  }

  static func sentTone(_ answer: String) -> ResolvedLine.Tone {
    switch answer {
    case "allow", "always", "always_routine", "always_bot_sites": .positive
    case "deny": .negative
    default: .neutral
    }
  }

  /// A button title: known approval ids get fixed words, anything else keeps the server's label.
  static func label(for action: AskAction, in ask: AskBlock) -> Text {
    if let fixed = fixedLabel(for: action, in: ask) { return fixed }
    guard ask.isApproval, action.outcome == nil else { return Text(verbatim: action.label) }
    switch action.id {
    // A payment's label already carries the amount ("Send $300.00"): keep it.
    case "allow":
      if action.label == "Allow for this run" { return Text("Allow for this run") }
      return action.label.hasPrefix("Send ") ? Text(verbatim: action.label) : Text("Allow once")
    case "always": return Text("Always allow")
    case "deny": return Text("Deny")
    default: return Text(verbatim: action.label)
    }
  }

  private static func fixedLabel(for action: AskAction, in ask: AskBlock) -> Text? {
    if ask.share {
      if action.id == "allow" { return Text("Share") }
      if action.id == "deny" { return Text("Don’t share") }
    }
    if ask.isConsent {
      if action.id == "allow" { return Text("Allow") }
      if action.id == "deny" { return Text("Not now") }
    }
    return nil
  }
}
