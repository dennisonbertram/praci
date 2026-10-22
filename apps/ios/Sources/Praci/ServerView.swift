import RakazoCore
import RakazoUI
import SwiftUI

struct ServerView: View {
  @Bindable var model: AuthenticationModel
  @Environment(\.dismiss) private var dismiss
  @Environment(\.colorScheme) private var colorScheme
  @State private var address = ""
  @State private var pendingEndpoint: URL?
  @State private var confirming = false
  @State private var error: String?

  private var warning: String {
    var messages: [String] = []
    if pendingEndpoint?.scheme == "http" {
      messages.append("This connection is unencrypted. Only continue on a trusted network.")
    }
    if model.isSignedIn {
      messages.append("Changing servers signs you out.")
    }
    return messages.joined(separator: "\n\n")
  }

  var body: some View {
    NavigationStack {
      Form {
        Section {
          TextField("https://app.example.com", text: $address)
            .keyboardType(.URL)
            .textInputAutocapitalization(.never)
            .autocorrectionDisabled()
            .accessibilityLabel("Server address")
            .accessibilityIdentifier("serverAddress")
            .onSubmit { prepareSave() }
            .disabled(model.busy)
        } header: {
          Text("Server address")
        }
        Section {
          Button("Use default server") {
            address = ServerEndpoint.defaultURL.absoluteString
            prepareSave()
          }
          .disabled(model.busy)
          if model.busy { ProgressView("Checking server…") }
          AuthStatus(error: error, notice: nil)
        }
      }
      .navigationTitle("Server")
      .navigationBarTitleDisplayMode(.inline)
      .tint(RakazoTokens.color(.primary, for: colorScheme))
      .toolbar {
        ToolbarItem(placement: .cancellationAction) {
          Button("Cancel") { dismiss() }
            .disabled(model.busy)
        }
        ToolbarItem(placement: .confirmationAction) {
          Button("Save") { prepareSave() }
            .disabled(model.busy || address.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty)
        }
      }
      .alert("Use this server?", isPresented: $confirming) {
        Button("Cancel", role: .cancel) { pendingEndpoint = nil }
        Button(pendingEndpoint?.scheme == "http" ? "Use anyway" : "Change server") {
          if let pendingEndpoint { save(pendingEndpoint) }
        }
      } message: {
        Text(warning)
      }
      .onAppear { address = model.endpoint.absoluteString }
      .interactiveDismissDisabled(model.busy)
    }
  }

  private func prepareSave() {
    guard !model.busy else { return }
    error = nil
    do {
      let endpoint = try ServerEndpoint.normalize(address)
      if endpoint == model.endpoint {
        dismiss()
      } else if endpoint.scheme == "http" || model.isSignedIn {
        pendingEndpoint = endpoint
        confirming = true
      } else {
        save(endpoint)
      }
    } catch {
      self.error =
        (error as? any LocalizedError)?.errorDescription ?? "Enter a valid server address."
    }
  }

  private func save(_ endpoint: URL) {
    Task {
      if await model.changeServer(to: endpoint) {
        dismiss()
      } else {
        error = model.errorMessage
      }
    }
  }
}
