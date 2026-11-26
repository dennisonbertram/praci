import RakazoCore
import RakazoUI
import SwiftUI
import VisionKit

struct ServerView: View {
  @Bindable var model: AuthenticationModel
  @Environment(\.dismiss) private var dismiss
  @Environment(\.colorScheme) private var colorScheme
  @State private var address = ""
  @State private var pendingEndpoint: URL?
  @State private var confirming = false
  @State private var error: String?
  @State private var scannerPresented = false
  @State private var scannerSession: UUID?
  @State private var scannerRevision: Int?
  @State private var scannedText: String?
  @State private var scanErrorRevision: Int?

  private var scannerSupported: Bool {
    #if targetEnvironment(simulator)
      false
    #else
      DataScannerViewController.isSupported
    #endif
  }

  private var warning: String {
    var messages = pendingEndpoint.map(\.serverName).map { [$0] } ?? []
    if pendingEndpoint?.scheme == "http" {
      messages.append("This connection is unencrypted. Only continue on a trusted network.")
    }
    if model.willSignOutWhenChangingServer(to: pendingEndpoint) {
      messages.append("Changing servers signs you out.")
    }
    return messages.joined(separator: "\n\n")
  }

  var body: some View {
    NavigationStack {
      Form {
        if scannerSupported {
          Section {
            Button("Scan QR code") { openScanner() }
              .disabled(model.busy)
          }
        }
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
          if let builtIn = ServerEndpoint.builtInURL {
            Button("Use default server") {
              address = builtIn.absoluteString
              prepareSave()
            }
            .disabled(model.busy)
          }
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
        Button("Cancel", role: .cancel) { cancelConfirmation() }
        Button(pendingEndpoint?.scheme == "http" ? "Use anyway" : "Change server") {
          guard let pendingEndpoint else { return }
          if model.pendingServer == pendingEndpoint {
            confirmExternalServer()
          } else {
            save(pendingEndpoint)
          }
        }
      } message: {
        Text(warning)
      }
      .onAppear {
        address = model.hasServer ? model.endpoint.absoluteString : ""
        if model.pendingServer != nil || model.serverLinkError != nil {
          receiveExternalServerLink()
        }
      }
      .onChange(of: model.serverLinkRevision) { _, _ in receiveExternalServerLink() }
      .onChange(of: model.busy) { wasBusy, isBusy in
        if wasBusy, !isBusy { presentPendingServerConfirmation() }
      }
      .interactiveDismissDisabled(model.busy)
      .sheet(isPresented: $scannerPresented, onDismiss: finishScannerDismissal) {
        if let scannerSession {
          ServerQRScannerSheet(sessionID: scannerSession, onScan: receiveScannedText)
        }
      }
    }
  }

  private func prepareSave() {
    guard !model.busy else { return }
    error = nil
    do {
      let endpoint = try ServerEndpoint.normalize(address)
      if endpoint == model.endpoint {
        // On a release first launch the screen holds the default address unsaved; save it.
        let revision = model.serverLinkRevision
        Task {
          await model.confirmCurrentServer()
          guard model.isCurrentServerLinkRevision(revision) else { return }
          dismiss()
        }
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

  private func receiveExternalServerLink() {
    let revision = model.serverLinkRevision
    if scannerSession != nil, scannerRevision != revision {
      scannerPresented = false
      scannedText = nil
    }
    let isScannedLink = scanErrorRevision == revision
    scanErrorRevision = nil
    confirming = false
    pendingEndpoint = nil
    error = model.serverLinkError
    guard let endpoint = model.pendingServer else {
      if !isScannedLink { address = "" }
      return
    }
    address = endpoint.absoluteString
    pendingEndpoint = endpoint
    presentPendingServerConfirmation(for: revision)
  }

  private func openScanner() {
    guard !model.busy else { return }
    scannerRevision = model.serverLinkRevision
    scannerSession = UUID()
    scannedText = nil
    scannerPresented = true
  }

  private func receiveScannedText(_ text: String, sessionID: UUID) {
    guard scannerPresented,
      scannerSession == sessionID,
      let revision = scannerRevision,
      model.isCurrentServerLinkRevision(revision)
    else {
      return
    }
    scannedText = text
    scannerPresented = false
  }

  private func finishScannerDismissal() {
    let text = scannedText
    let revision = scannerRevision
    scannerPresented = false
    scannedText = nil
    scannerSession = nil
    scannerRevision = nil
    if let text, let revision,
      model.stageServerLink(text, ifCurrentRevision: revision)
    {
      if model.pendingServer == nil {
        scanErrorRevision = model.serverLinkRevision
      }
    } else {
      presentPendingServerConfirmation()
    }
  }

  private func presentPendingServerConfirmation() {
    guard scannerSession == nil, !scannerPresented, model.pendingServer != nil else { return }
    presentPendingServerConfirmation(for: model.serverLinkRevision)
  }

  private func presentPendingServerConfirmation(for revision: Int) {
    guard !model.busy, scannerSession == nil, !scannerPresented, model.pendingServer != nil else {
      return
    }
    Task { @MainActor in
      await Task.yield()
      guard revision == model.serverLinkRevision, model.pendingServer != nil, !model.busy,
        scannerSession == nil, !scannerPresented
      else {
        return
      }
      confirming = true
    }
  }

  private func cancelConfirmation() {
    pendingEndpoint = nil
    if model.pendingServer != nil { model.cancelPendingServer() }
  }

  private func confirmExternalServer() {
    let revision = model.serverLinkRevision
    Task {
      let confirmed = await model.confirmPendingServer()
      guard model.isCurrentServerLinkRevision(revision) else { return }
      if confirmed {
        dismiss()
      } else if let error = model.errorMessage {
        self.error = error
      }
    }
  }

  private func save(_ endpoint: URL) {
    let revision = model.serverLinkRevision
    Task {
      let saved = await model.changeServer(to: endpoint)
      guard model.isCurrentServerLinkRevision(revision) else { return }
      if saved {
        dismiss()
      } else {
        error = model.errorMessage
      }
    }
  }
}

extension URL {
  /// The host and port a person recognises, without the scheme.
  var serverName: String {
    guard let host = host(percentEncoded: false) else { return absoluteString }
    return port.map { "\(host):\($0)" } ?? host
  }
}
