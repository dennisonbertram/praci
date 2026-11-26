import RakazoAPI
import SwiftUI

struct ModelsScreen: View {
  @Environment(AppModel.self) private var app
  @State private var model = ModelsModel()
  @State private var connecting = false

  var body: some View {
    LoadableView(state: model.state, retry: { Task { await model.load(app) } }, content: { snapshot in
      List {
        if let current = snapshot.defaultCredential, let modelID = current.modelId {
          defaultSection(snapshot, current: current, modelID: modelID)
        }
        Section("Providers") {
          ForEach(snapshot.credentials) { credential in
            NavigationLink {
              ProviderDetailScreen(credential: credential, model: model)
            } label: {
              LabeledContent(credential.label, value: "Connected")
            }
            .accessibilityIdentifier("provider-\(credential.provider)")
          }
          Button {
            connecting = true
          } label: {
            Label("Connect a model", systemImage: "plus")
          }
          .accessibilityIdentifier("connectModel")
        }
      }
    })
    .navigationTitle("Models")
    .navigationBarTitleDisplayMode(.inline)
    .task { await model.load(app) }
    .refreshable { await model.load(app) }
    .sheet(isPresented: $connecting) {
      ConnectModelSheet(providers: model.state.value?.providers ?? []) {
        await model.load(app)
      }
    }
  }

  private func defaultSection(_ snapshot: ModelsSnapshot, current: ModelCredential, modelID: String)
    -> some View
  {
    let option = snapshot.option(provider: current.provider, modelID: modelID)
    let levels = option?.thinkingLevels ?? []
    return Section {
      NavigationLink {
        DefaultModelList(snapshot: snapshot, model: model)
      } label: {
        LabeledContent("Model", value: option?.label ?? modelID)
      }
      .accessibilityIdentifier("defaultModel")
      if !levels.isEmpty {
        Picker(
          "Thinking",
          selection: Binding(
            get: { current.thinkingLevel ?? levels.first ?? "" },
            set: { level in
              Task {
                await model.setDefault(
                  app, provider: current.provider, modelID: modelID, thinking: level)
              }
            })
        ) {
          ForEach(levels, id: \.self) { Text($0.capitalized).tag($0) }
        }
        .accessibilityIdentifier("thinkingLevel")
      }
    } header: {
      Text("Default model")
    } footer: {
      if let error = model.error {
        Text(error).foregroundStyle(Color.token(.destructive))
      }
    }
  }
}

/// Models of the connected providers; choosing one makes it the default.
private struct DefaultModelList: View {
  @Environment(AppModel.self) private var app
  @Environment(\.dismiss) private var dismiss
  let snapshot: ModelsSnapshot
  let model: ModelsModel
  @State private var query = ""

  var body: some View {
    let connected = Set(snapshot.credentials.map(\.provider))
    let options = snapshot.providers.filter { connected.contains($0.id) }.flatMap(\.models)
      .filter { query.isEmpty || $0.label.localizedCaseInsensitiveContains(query) }
    List(options) { option in
      Button {
        Task {
          await model.setDefault(app, provider: option.provider, modelID: option.id, thinking: nil)
          dismiss()
        }
      } label: {
        LabeledContent(option.label, value: option.providerName)
      }
      .foregroundStyle(Color.token(.foreground))
    }
    .searchable(text: $query)
    .navigationTitle("Model")
    .navigationBarTitleDisplayMode(.inline)
  }
}

private struct ProviderDetailScreen: View {
  @Environment(AppModel.self) private var app
  @Environment(\.dismiss) private var dismiss
  let credential: ModelCredential
  let model: ModelsModel
  @State private var key = ""
  @State private var saving = false
  @State private var confirming = false

  private var supportsKey: Bool {
    model.state.value?.providers.first { $0.id == credential.provider }?.supportsKey ?? true
  }

  var body: some View {
    Form {
      Section {
        LabeledContent("Status", value: "Connected")
      }
      if supportsKey {
        Section {
          SecureField("API key", text: $key)
            .textContentType(.password)
            .autocorrectionDisabled()
            .textInputAutocapitalization(.never)
            .accessibilityIdentifier("providerKey")
          Button("Save key") {
            saving = true
            let input = ConnectInput(
              provider: credential.provider, apiKey: key, label: credential.label,
              modelId: credential.modelId)
            Task {
              if await model.connect(app, input) { key = "" }
              saving = false
            }
          }
          .disabled(key.isEmpty || saving)
          .accessibilityIdentifier("saveKey")
        } footer: {
          if let error = model.error {
            Text(error).foregroundStyle(Color.token(.destructive))
          }
        }
      }
      Section {
        Button("Disconnect", role: .destructive) { confirming = true }
          .accessibilityIdentifier("disconnect")
      }
    }
    .navigationTitle(credential.label)
    .navigationBarTitleDisplayMode(.inline)
    .onAppear { model.error = nil }
    .confirmationDialog("Disconnect \(credential.label)?", isPresented: $confirming) {
      Button("Disconnect", role: .destructive) {
        Task { if await model.disconnect(app, provider: credential.provider) { dismiss() } }
      }
    }
  }
}
