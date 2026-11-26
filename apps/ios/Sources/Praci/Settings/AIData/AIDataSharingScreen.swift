import Observation
import RakazoCore
import SwiftUI

struct ConsentRevokeInput: Encodable, Sendable {
  var key: String?

  enum CodingKeys: String, CodingKey { case key }

  // The server requires the key field; null revokes every recipient.
  func encode(to encoder: any Encoder) throws {
    var container = encoder.container(keyedBy: CodingKeys.self)
    try container.encode(key, forKey: .key)
  }
}

@MainActor
@Observable
final class AIDataModel {
  var state: Loadable<AIConsentStatus> = .idle
  var error: String?

  func load(_ app: AppModel) async {
    if state.value == nil { state = .loading }
    do {
      state = .loaded(try await app.call("aiConsent/status", input: ConsentStatusInput()))
    } catch {
      state = .failed(settingsErrorText(error))
    }
  }

  func allow(_ app: AppModel, _ recipient: AIRecipient) async {
    guard let status = state.value else { return }
    await update {
      try await app.call(
        "aiConsent/allow",
        input: ConsentAllowInput(
          scope: status.scope, version: status.version, keys: [recipient.key]))
    }
  }

  func revoke(_ app: AppModel, _ recipient: AIRecipient) async {
    await update {
      try await app.call("aiConsent/revoke", input: ConsentRevokeInput(key: recipient.key))
    }
  }

  private func update(_ call: () async throws -> AIConsentStatus) async {
    error = nil
    do { state = .loaded(try await call()) } catch { self.error = settingsErrorText(error) }
  }
}

struct AIDataSharingScreen: View {
  @Environment(AppModel.self) private var app
  @Environment(\.openURL) private var openURL
  @State private var model = AIDataModel()
  @State private var asking: AIRecipient?

  var body: some View {
    LoadableView(state: model.state, retry: { Task { await model.load(app) } }, content: { status in
      List {
        ForEach([AIDataUse.model, .voice, .memory], id: \.self) { use in
          let recipients = status.recipients.filter { $0.use == use }
          if !recipients.isEmpty {
            Section {
              ForEach(recipients, id: \.key) { recipient in
                Toggle(
                  isOn: Binding(
                    get: { recipient.allowed },
                    set: { granted in
                      if granted { asking = recipient } else { Task { await model.revoke(app, recipient) } }
                    })
                ) {
                  VStack(alignment: .leading) {
                    Text(recipient.name)
                    if !recipient.detail.isEmpty {
                      Text(recipient.detail).font(.caption)
                        .foregroundStyle(Color.token(.mutedForeground))
                    }
                  }
                }
                .accessibilityIdentifier("share-\(recipient.name)")
              }
            } header: {
              Text(Self.title(use))
            } footer: {
              if use == .model, recipients.contains(where: { !$0.allowed }) {
                Text("Agents are paused until \(recipients.first { !$0.allowed }?.name ?? "") is on.")
              }
            }
          }
        }
        Section {
          if let error = model.error { Text(error).foregroundStyle(Color.token(.destructive)) }
          if let url = status.privacyURL.flatMap(URL.init(string:)) {
            Button("Privacy details") { openURL(url) }
          }
        }
      }
    })
    .navigationTitle("AI data sharing")
    .navigationBarTitleDisplayMode(.inline)
    .task { await model.load(app) }
    .refreshable { await model.load(app) }
    .sheet(isPresented: Binding(get: { asking != nil }, set: { if !$0 { asking = nil } })) {
      if let recipient = asking {
        ConsentSheet(
          procedure: "threads/send", recipient: recipient,
          privacyURL: model.state.value?.privacyURL
        ) { allowed in
          asking = nil
          if allowed { Task { await model.allow(app, recipient) } }
        }
      }
    }
  }

  private static func title(_ use: AIDataUse) -> LocalizedStringKey {
    switch use {
    case .model: "Messages and attachments"
    case .voice: "Recordings and spoken text"
    case .memory: "Summaries and memories"
    }
  }
}
