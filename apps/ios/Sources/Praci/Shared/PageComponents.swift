import SwiftUI

struct RefreshErrorSection: View {
  let message: String?
  let retry: () async -> Void

  var body: some View {
    if let message {
      Section {
        Label(message, systemImage: "exclamationmark.triangle")
          .foregroundStyle(Color.token(.destructive))
        Button("Try again") { Task { await retry() } }
      }
    }
  }
}

private struct ActionErrorAlertModifier: ViewModifier {
  let title: LocalizedStringKey
  let cancelButton: Bool
  @Binding var message: String?

  func body(content: Content) -> some View {
    content.alert(
      title,
      isPresented: Binding(
        get: { message != nil },
        set: { if !$0 { message = nil } })) {
          if cancelButton {
            Button("OK", role: .cancel) { message = nil }
          } else {
            Button("OK") { message = nil }
          }
        } message: {
          Text(verbatim: message ?? "")
        }
  }
}

extension View {
  func actionErrorAlert(
    _ title: LocalizedStringKey, message: Binding<String?>, cancelButton: Bool = false
  ) -> some View {
    modifier(ActionErrorAlertModifier(title: title, cancelButton: cancelButton, message: message))
  }
}

struct AskAgentButton: View {
  @Environment(AppModel.self) private var app
  let title: LocalizedStringKey
  private let botID: String?
  private let action: (() -> Void)?
  private let isLoading: Bool
  private let fillsWidth: Bool
  let accessibilityIdentifier: String?

  init(title: LocalizedStringKey, botID: String, accessibilityIdentifier: String?) {
    self.title = title
    self.botID = botID
    action = nil
    isLoading = false
    fillsWidth = false
    self.accessibilityIdentifier = accessibilityIdentifier
  }

  init(
    title: LocalizedStringKey,
    action: @escaping () -> Void,
    isLoading: Bool = false,
    fillsWidth: Bool = false,
    accessibilityIdentifier: String?
  ) {
    self.title = title
    botID = nil
    self.action = action
    self.isLoading = isLoading
    self.fillsWidth = fillsWidth
    self.accessibilityIdentifier = accessibilityIdentifier
  }

  @ViewBuilder
  var body: some View {
    let button = Button {
      if let action { action() }
      else if let botID { app.open(.thread(.bot(botID))) }
    } label: {
      if isLoading || fillsWidth {
        HStack {
          if isLoading { ProgressView() }
          Label(title, systemImage: "bubble.left")
        }
        .foregroundStyle(Color.token(.primaryForeground))
        .frame(maxWidth: .infinity)
      } else {
        Label(title, systemImage: "bubble.left")
      }
    }
    if let accessibilityIdentifier { button.accessibilityIdentifier(accessibilityIdentifier) }
    else { button }
  }
}
