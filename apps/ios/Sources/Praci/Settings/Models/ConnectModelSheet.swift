import RakazoAPI
import SwiftUI

private enum ConnectStep: Hashable {
  case signIn(String)
  case moreSignIn
  case apiKey
  case localServer
}

/// J1: "Sign in" leads; API key and Local server sit under "Other ways".
struct ConnectModelSheet: View {
  @Environment(\.dismiss) private var dismiss
  let providers: [ModelProvider]
  let onConnected: () async -> Void
  @State private var path: [ConnectStep] = []

  private var signIn: [ModelProvider] { providers.signInProviders }

  var body: some View {
    NavigationStack(path: $path) {
      List {
        if let lead = signIn.first {
          Section {
            Button {
              path.append(.signIn(lead.id))
            } label: {
              Text(lead.signInLabel).frame(maxWidth: .infinity)
                .foregroundStyle(Color.token(.primaryForeground))
            }
            .buttonStyle(.borderedProminent)
            .controlSize(.large)
            .listRowBackground(Color.clear)
            .accessibilityIdentifier("signInLead")
          } footer: {
            Text("Uses your \(lead.name) plan.")
          }
        }
        Section("Other ways") {
          if signIn.count > 1 {
            NavigationLink("More sign-in options", value: ConnectStep.moreSignIn)
          }
          NavigationLink("API key", value: ConnectStep.apiKey)
            .accessibilityIdentifier("otherApiKey")
          NavigationLink("Local server", value: ConnectStep.localServer)
            .accessibilityIdentifier("otherLocalServer")
        }
      }
      .navigationTitle("Connect a model")
      .navigationBarTitleDisplayMode(.inline)
      .toolbar {
        ToolbarItem(placement: .cancellationAction) {
          Button("Close", systemImage: "xmark") { dismiss() }.labelStyle(.iconOnly)
        }
      }
      .navigationDestination(for: ConnectStep.self) { step in
        switch step {
        case .signIn(let id):
          if let provider = providers.first(where: { $0.id == id }) {
            SignInFlowView(provider: provider, onConnected: finished)
          }
        case .moreSignIn:
          List(signIn.dropFirst()) { provider in
            NavigationLink(provider.signInLabel, value: ConnectStep.signIn(provider.id))
          }
          .navigationTitle("Sign in")
          .navigationBarTitleDisplayMode(.inline)
        case .apiKey:
          APIKeyForm(providers: providers.filter { $0.supportsKey && !$0.isLocalServer }, onConnected: finished)
        case .localServer:
          LocalServerForm(onConnected: finished)
        }
      }
    }
  }

  private func finished() {
    Task {
      await onConnected()
      dismiss()
    }
  }
}

private struct SignInFlowView: View {
  @Environment(AppModel.self) private var app
  @Environment(\.openURL) private var openURL
  @Environment(\.dismiss) private var dismiss
  let provider: ModelProvider
  let onConnected: () -> Void
  @State private var model = SignInModel()
  @State private var code = ""

  var body: some View {
    Form {
      switch model.phase {
      case .starting:
        ProgressView().frame(maxWidth: .infinity)
      case .waiting(let begin):
        waiting(begin)
      case .failed(let message):
        Section {
          Text(message).foregroundStyle(Color.token(.destructive))
          Button("Try again") {
            Task {
              await model.cancel(app)
              await model.start(app, provider: provider)
            }
          }
        }
      case .done:
        ProgressView().frame(maxWidth: .infinity)
      }
    }
    .navigationTitle(provider.name)
    .navigationBarTitleDisplayMode(.inline)
    .task { await model.start(app, provider: provider) }
    .onDisappear { Task { await model.cancel(app) } }
    .onChange(of: isDone) { _, done in if done { onConnected() } }
  }

  private var isDone: Bool {
    if case .done = model.phase { true } else { false }
  }

  @ViewBuilder
  private func waiting(_ begin: ModelOAuthBegin) -> some View {
    if let userCode = begin.userCode {
      Section {
        Text(userCode)
          .font(.title.monospaced())
          .frame(maxWidth: .infinity)
          .textSelection(.enabled)
          .accessibilityIdentifier("userCode")
        Button("Copy code and open Safari") {
          UIPasteboard.general.string = userCode
          if let url = URL(string: begin.verificationUri) { openURL(url) }
        }
        .accessibilityIdentifier("openSafari")
      } footer: {
        Text("Paste the code on the \(provider.name) page.")
      }
    } else {
      Section {
        Button("Open Safari") {
          if let url = URL(string: begin.verificationUri) { openURL(url) }
        }
        .accessibilityIdentifier("openSafari")
      } footer: {
        Text("Approve the sign-in in Safari, then paste the code it shows.")
      }
      Section {
        SecureField("Code", text: $code)
          .autocorrectionDisabled()
          .textInputAutocapitalization(.never)
          .accessibilityIdentifier("oauthCode")
        Button("Continue") {
          let value = code.trimmingCharacters(in: .whitespacesAndNewlines)
          code = ""
          Task { await model.submit(app, code: value) }
        }
        .disabled(code.isEmpty || model.submittingCode)
      }
    }
    Section {
      HStack {
        ProgressView()
        Text("Waiting for approval").foregroundStyle(Color.token(.mutedForeground))
      }
      Button("Cancel", role: .cancel) {
        Task {
          await model.cancel(app)
          dismiss()
        }
      }
    }
  }
}

private struct APIKeyForm: View {
  @Environment(AppModel.self) private var app
  let providers: [ModelProvider]
  let onConnected: () -> Void
  @State private var model = ModelsModel()
  @State private var providerID = ""
  @State private var key = ""
  @State private var busy = false

  private var selected: ModelProvider? {
    providers.first { $0.id == providerID } ?? providers.first
  }

  var body: some View {
    Form {
      Section {
        Picker("Provider", selection: $providerID) {
          ForEach(providers) { Text($0.name).tag($0.id) }
        }
        .pickerStyle(.navigationLink)
        .accessibilityIdentifier("keyProvider")
      }
      Section {
        HStack {
          SecureField("API key", text: $key)
            .textContentType(.password)
            .autocorrectionDisabled()
            .textInputAutocapitalization(.never)
            .accessibilityIdentifier("apiKey")
          Button("Paste") { key = UIPasteboard.general.string ?? key }
            .buttonStyle(.borderless)
        }
      } footer: {
        if let error = model.error {
          Text(error).foregroundStyle(Color.token(.destructive))
        } else if let name = selected?.name {
          Text("Paste the key from your \(name) account.")
        }
      }
      Section {
        Button {
          guard let selected, let first = selected.models.first else { return }
          busy = true
          let input = ConnectInput(
            provider: selected.id, apiKey: key.trimmingCharacters(in: .whitespacesAndNewlines),
            label: selected.name, modelId: first.id)
          Task {
            if await model.connect(app, input) {
              key = ""
              onConnected()
            }
            busy = false
          }
        } label: {
          if busy { ProgressView().frame(maxWidth: .infinity) } else {
            Text("Connect").frame(maxWidth: .infinity)
              .foregroundStyle(Color.token(.primaryForeground))
          }
        }
        .buttonStyle(.borderedProminent)
        .disabled(key.isEmpty || busy)
        .listRowBackground(Color.clear)
        .accessibilityIdentifier("connectKey")
      }
    }
    .navigationTitle("API key")
    .navigationBarTitleDisplayMode(.inline)
    .onAppear { if providerID.isEmpty { providerID = providers.first?.id ?? "" } }
  }
}

private struct LocalServerForm: View {
  @Environment(AppModel.self) private var app
  let onConnected: () -> Void
  @State private var model = ModelsModel()
  @State private var address = ""
  @State private var found: [String] = []
  @State private var chosen = ""
  @State private var finding = false
  @State private var message: String?

  var body: some View {
    Form {
      Section {
        TextField("http://192.168.1.20:8000/v1", text: $address)
          .keyboardType(.URL)
          .autocorrectionDisabled()
          .textInputAutocapitalization(.never)
          .accessibilityIdentifier("serverAddress")
      } header: {
        Text("Address")
      } footer: {
        if let text = message ?? model.error {
          Text(text).foregroundStyle(Color.token(.destructive))
        } else {
          Text("Only works on the same network.")
        }
      }
      Section {
        Button("Find models") { Task { await find() } }
          .disabled(address.isEmpty || finding)
          .accessibilityIdentifier("findModels")
      }
      if !found.isEmpty {
        Section("Models") {
          Picker("Model", selection: $chosen) {
            ForEach(found, id: \.self) { Text($0).tag($0) }
          }
          .pickerStyle(.inline)
          .labelsHidden()
        }
        Section {
          Button {
            let input = ConnectInput(
              provider: "openai-compatible", label: "Local server", modelId: chosen,
              baseUrl: address)
            Task { if await model.connect(app, input) { onConnected() } }
          } label: {
            Text("Connect").frame(maxWidth: .infinity)
              .foregroundStyle(Color.token(.primaryForeground))
          }
          .buttonStyle(.borderedProminent)
          .listRowBackground(Color.clear)
        }
      }
    }
    .navigationTitle("Local server")
    .navigationBarTitleDisplayMode(.inline)
  }

  private func find() async {
    finding = true
    message = nil
    found = []
    defer { finding = false }
    do {
      let result: ProbedModels = try await app.call(
        "models/probeOpenAiCompatible", input: ProbeInput(baseUrl: address))
      found = result.models
      chosen = result.models.first ?? ""
      if found.isEmpty { message = "No models found at this address. Check it and try again." }
    } catch {
      message = "Could not reach this server."
    }
  }
}

private struct ProbeInput: Encodable, Sendable { var baseUrl: String }
