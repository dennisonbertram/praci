import RakazoUI
import SwiftUI

struct ChangePasswordScreen: View {
  let model: AccountModel
  @Environment(AppModel.self) private var app
  @Environment(\.dismiss) private var dismiss
  @State private var form = ChangePasswordForm()

  var body: some View {
    Form {
      Section {
        SecureField("Current password", text: $form.current)
          .textContentType(.password)
          .accessibilityIdentifier("currentPassword")
      }
      Section {
        SecureField("New password", text: $form.new)
          .textContentType(.newPassword)
          .accessibilityIdentifier("newPassword")
        SecureField("Confirm new password", text: $form.confirmation)
          .textContentType(.newPassword)
          .accessibilityIdentifier("confirmPassword")
      } footer: {
        if let error = form.error {
          Text(error.message).foregroundStyle(Color.token(.destructive))
        } else if let message = model.errorMessage {
          Text(message).foregroundStyle(Color.token(.destructive))
        } else {
          Text("At least 8 characters")
        }
      }
    }
    .navigationTitle("Change password")
    .navigationBarTitleDisplayMode(.inline)
    .safeAreaInset(edge: .bottom) {
      Button {
        Task { if await model.changePassword(form, app) { dismiss() } }
      } label: {
        if model.busy {
          ProgressView().frame(maxWidth: .infinity)
        } else {
          Text("Save password").frame(maxWidth: .infinity)
        }
      }
      .buttonStyle(.borderedProminent)
      .controlSize(.large)
      .disabled(!form.canSave || form.error != nil || model.busy)
      .padding()
      .accessibilityIdentifier("savePassword")
    }
    .onAppear { model.errorMessage = nil }
  }
}
