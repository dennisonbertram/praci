import RakazoCore
import RakazoUI
import SwiftUI

struct DeleteAccountSheet: View {
  let model: AccountModel
  let security: AccountSecurity?
  let email: String
  @Environment(AppModel.self) private var app
  @Environment(\.dismiss) private var dismiss
  @State private var secret = ""

  private var usesPassword: Bool { security?.hasPassword ?? true }
  private var canEmail: Bool { security?.emailDeletion ?? false }

  var body: some View {
    NavigationStack {
      Form {
        Section {
          Text(
            """
            This permanently deletes your account, agents, conversations, memories, files, \
            and saved connections. This cannot be undone.
            """
          )
        }
        if usesPassword {
          Section {
            SecureField("Current password", text: $secret)
              .textContentType(.password)
              .accessibilityIdentifier("deletePassword")
          }
        } else if canEmail {
          Section {
            TextField("Code from email", text: $secret)
              .textContentType(.oneTimeCode)
              .keyboardType(.asciiCapable)
              .textInputAutocapitalization(.never)
              .autocorrectionDisabled()
              .accessibilityIdentifier("deleteCode")
          } footer: {
            if model.codeSent { Text("We emailed a code to \(email).") }
          }
          Section {
            Button("Resend code") { Task { await model.sendDeletionCode(app) } }
              .disabled(model.busy)
          }
        } else {
          Section { Text("Account deletion is not available on this server.") }
        }
        if let message = model.errorMessage {
          Section { Text(message).foregroundStyle(Color.token(.destructive)) }
        }
      }
      .navigationTitle("Delete your account?")
      .navigationBarTitleDisplayMode(.inline)
      .toolbar {
        ToolbarItem(placement: .cancellationAction) {
          Button { dismiss() } label: { Label("Cancel", systemImage: "xmark") }
        }
      }
      .safeAreaInset(edge: .bottom) {
        Button(role: .destructive) {
          Task {
            let proof: AccountDeletionProof =
              usesPassword ? .password(secret) : .emailedCode(AccountModel.cleanCode(secret))
            if await model.delete(proof, app) { dismiss() }
          }
        } label: {
          if model.busy {
            ProgressView().frame(maxWidth: .infinity)
          } else {
            Text("Delete").frame(maxWidth: .infinity)
          }
        }
        .buttonStyle(.borderedProminent)
        .controlSize(.large)
        .disabled(
          (usesPassword ? secret.isEmpty : AccountModel.cleanCode(secret).isEmpty) || model.busy)
        .padding()
        .accessibilityIdentifier("confirmDelete")
      }
      .task {
        model.errorMessage = nil
        if !usesPassword, canEmail, !model.codeSent { await model.sendDeletionCode(app) }
      }
    }
    .presentationDetents([.medium, .large])
  }
}
