import RakazoAPI
import SwiftUI

/// A request for a password, API key or login. The typed value goes only to `threads.answer`:
/// it is cleared from the fields the moment Save is tapped and is never logged, kept, or shown.
struct SecretAskView: View {
  let ask: AskBlock
  let messageID: String
  let model: ThreadModel
  let approval: ApprovalModel
  @State private var username = ""
  @State private var secret = ""
  @Environment(AppModel.self) private var app

  private var canAnswer: Bool { model.canAnswerAsk(messageID) }
  private var fieldTitle: LocalizedStringKey {
    if ask.isLogin || ask.purpose == "password" { return "Password" }
    return ask.purpose == "api_key" ? "API key" : "Code"
  }
  private var incomplete: Bool {
    secret.isEmpty || (ask.isLogin && username.trimmingCharacters(in: .whitespaces).isEmpty)
  }

  var body: some View {
    VStack(alignment: .leading, spacing: 10) {
      Text(ask.text).font(.body.weight(.semibold))
      if let destination {
        Text(verbatim: destination).font(.footnote).foregroundStyle(Color.token(.mutedForeground))
      }
      if ask.isAnswered || approval.sentAnswer != nil {
        ResolvedLine(text: Text("Saved"), tone: .positive)
      } else if canAnswer {
        fields
      } else {
        Text("No longer active").font(.footnote).foregroundStyle(Color.token(.mutedForeground))
      }
    }
    .approvalCardChrome()
    .accessibilityElement(children: .contain)
    .accessibilityIdentifier("approvalCard")
    // The typed value never outlives the card.
    .onDisappear { secret = ""; username = "" }
  }

  private var destination: String? {
    guard let credential = ask.credential else { return nil }
    if credential.authType == "command" {
      return String(localized: "Command variable") + " · " + credential.name
    }
    return credential.origin
  }

  @ViewBuilder private var fields: some View {
    if ask.isLogin {
      TextField("Username", text: $username)
        .textInputAutocapitalization(.never).autocorrectionDisabled()
        .textContentType(.username)
        .textFieldStyle(.roundedBorder)
        .disabled(approval.pending != nil)
        .accessibilityIdentifier("secretUsername")
    }
    SecureField(fieldTitle, text: $secret)
      .textInputAutocapitalization(.never).autocorrectionDisabled()
      .textFieldStyle(.roundedBorder)
      .disabled(approval.pending != nil)
      .onSubmit { submit() }
      .accessibilityIdentifier("secretField")
    CardActionButton(
      title: Text("Save"), style: .prominent, busy: approval.pending != nil,
      disabled: incomplete, identifier: "secretSave"
    ) { submit() }
  }

  private func submit() {
    guard !incomplete, approval.pending == nil else { return }
    let value = secret
    let name = ask.isLogin ? username.trimmingCharacters(in: .whitespaces) : nil
    secret = ""
    username = ""
    Task {
      await approval.answer(value, id: "secret", secret: true, username: name, messageID: messageID, app: app, thread: model)
    }
  }
}
