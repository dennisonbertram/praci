import RakazoAPI
import SwiftUI

struct VoiceSettingsScreen: View {
  @Environment(AppModel.self) private var app
  @State private var model = VoiceModel()
  @State private var speaker = DeviceSpeaker()
  @AppStorage(VoicePreferences.deviceVoiceKey) private var useDevice = true
  @AppStorage(VoicePreferences.callSoundsKey) private var callSounds = true
  @AppStorage(VoicePreferences.waitSoundKey) private var waitSound = true

  var body: some View {
    LoadableView(state: model.state, retry: { Task { await model.load(app) } }, content: { snapshot in
      Form {
        Section("Speak with") {
          Button {
            useDevice = true
          } label: {
            choiceRow("This device", detail: "Free, works offline", selected: useDevice)
          }
          .accessibilityIdentifier("voiceDevice")
          Button {
            useDevice = false
          } label: {
            choiceRow("Hosted voice", detail: LocalizedStringKey(snapshot.hostedSummary), selected: !useDevice)
          }
          .accessibilityIdentifier("voiceHosted")
          NavigationLink {
            HostedVoiceScreen(model: model)
          } label: {
            Text("Hosted voice settings")
          }
          .accessibilityIdentifier("hostedVoiceSettings")
        }
        Section("Sounds") {
          Toggle("Call sounds", isOn: $callSounds).accessibilityIdentifier("callSounds")
          Toggle("Waiting sound", isOn: $waitSound).accessibilityIdentifier("waitSound")
        }
      }
    })
    .navigationTitle("Voice")
    .navigationBarTitleDisplayMode(.inline)
    .toolbar {
      if useDevice {
        ToolbarItem(placement: .primaryAction) {
          Button("Hear sample", systemImage: "play.fill") {
            speaker.speak("Hi, this is how I’ll sound when I read replies out loud.")
          }
          .buttonStyle(.borderedProminent)
          .accessibilityIdentifier("hearSample")
        }
      }
    }
    .task { await model.load(app) }
    .refreshable { await model.load(app) }
  }

  private func choiceRow(_ title: LocalizedStringKey, detail: LocalizedStringKey, selected: Bool) -> some View {
    HStack {
      VStack(alignment: .leading, spacing: 2) {
        Text(title).foregroundStyle(Color.token(.foreground))
        Text(detail).font(.footnote).foregroundStyle(Color.token(.mutedForeground))
      }
      Spacer()
      if selected { Image(systemName: "checkmark").foregroundStyle(Color.token(.primary)) }
    }
    .accessibilityElement(children: .combine)
    .accessibilityAddTraits(selected ? .isSelected : [])
  }
}

struct HostedVoiceScreen: View {
  @Environment(AppModel.self) private var app
  let model: VoiceModel
  @State private var providerID: String?
  @State private var apiKey = ""
  @State private var speechModel = ""
  @State private var disconnecting = false

  var body: some View {
    Form {
      if let snapshot = model.state.value {
        content(snapshot)
      }
    }
    .scrollDismissesKeyboard(.immediately)
    .navigationTitle("Hosted voice")
    .navigationBarTitleDisplayMode(.inline)
    .task {
      if let snapshot = model.state.value { await select(snapshot.activeProviderID, snapshot) }
    }
    .confirmationDialog("Disconnect hosted voice?", isPresented: $disconnecting, titleVisibility: .visible) {
      Button("Disconnect", role: .destructive) {
        guard let providerID else { return }
        Task {
          await model.disconnect(app, provider: providerID)
          model.voices = []
        }
      }
    }
  }

  @ViewBuilder
  // swiftlint:disable:next function_body_length
  private func content(_ snapshot: VoiceSnapshot) -> some View {
    let selected = snapshot.providers.first { $0.id == providerID }
    let credential = providerID.flatMap(snapshot.credential(for:))
    Section("Provider") {
      ForEach(snapshot.providers) { provider in
        Button {
          Task { await select(provider.id, snapshot) }
        } label: {
          HStack {
            VStack(alignment: .leading, spacing: 2) {
              Text(provider.name).foregroundStyle(Color.token(.foreground))
              Text(providerDetail(provider, snapshot))
                .font(.footnote).foregroundStyle(Color.token(.mutedForeground))
            }
            Spacer()
            if provider.id == providerID {
              Image(systemName: "checkmark").foregroundStyle(Color.token(.primary))
            }
          }
        }
        .accessibilityIdentifier("voiceProvider-\(provider.id)")
      }
    }
    if let selected {
      Section {
        SecureField(credential == nil ? "Paste your API key" : "Paste a replacement key", text: $apiKey)
          .textContentType(.password)
          .textInputAutocapitalization(.never)
          .autocorrectionDisabled()
          .submitLabel(.go)
          .onSubmit { connect(selected.id, snapshot) }
          .accessibilityIdentifier("voiceApiKey")
        Button(credential == nil ? "Connect" : "Replace key") { connect(selected.id, snapshot) }
        .disabled(model.busy || apiKey.trimmingCharacters(in: .whitespacesAndNewlines).count < 8)
        .accessibilityIdentifier("voiceConnect")
      } header: {
        Text("API key")
      } footer: {
        if let error = model.error {
          Text(error).foregroundStyle(Color.token(.destructive)).accessibilityIdentifier("voiceError")
        }
      }
      if let credential {
        if selected.id == "fish-audio" {
          Section("Speech model") {
            TextField("Optional", text: $speechModel)
              .textInputAutocapitalization(.never)
              .autocorrectionDisabled()
              .onSubmit {
                let next = speechModel.trimmingCharacters(in: .whitespacesAndNewlines)
                if next != credential.speechModel {
                  Task { await model.setSpeechModel(app, provider: selected.id, model: next) }
                }
              }
              .accessibilityIdentifier("speechModel")
          }
        }
        if !model.voices.isEmpty {
          Section("Voice") {
            ForEach(model.voices) { voice in
              Button {
                Task { await model.setVoice(app, provider: selected.id, voiceID: voice.id) }
              } label: {
                HStack {
                  Text(voice.label).foregroundStyle(Color.token(.foreground))
                  Spacer()
                  if credential.voiceId == voice.id {
                    Image(systemName: "checkmark").foregroundStyle(Color.token(.primary))
                  }
                }
              }
              .accessibilityIdentifier("voice-\(voice.id)")
            }
          }
        }
        transcription(snapshot, provider: selected)
        Section {
          Button("Disconnect", role: .destructive) { disconnecting = true }
            .disabled(model.busy)
            .accessibilityIdentifier("voiceDisconnect")
        }
      }
    }
  }

  /// A provider that can transcribe takes its key again; the server keeps that choice separate.
  @ViewBuilder
  private func transcription(_ snapshot: VoiceSnapshot, provider: VoiceProvider) -> some View {
    if provider.transcribe || snapshot.status.transcriptionProvider != nil {
      Section("Transcription") {
        if let active = snapshot.status.transcriptionProvider {
          LabeledContent("Transcribing with", value: snapshot.providers.first { $0.id == active }?.name ?? active)
          Button("Turn off transcription") { Task { await model.clearTranscription(app) } }
            .disabled(model.busy)
            .accessibilityIdentifier("transcriptionOff")
        } else {
          Button("Turn on transcription") {
            // Reuses the key field above so the key is typed once.
            let key = apiKey.trimmingCharacters(in: .whitespacesAndNewlines)
            Task {
              if await model.setTranscription(app, provider: provider.id, apiKey: key) { apiKey = "" }
            }
          }
          .disabled(model.busy || apiKey.trimmingCharacters(in: .whitespacesAndNewlines).count < 8)
          .accessibilityIdentifier("transcriptionOn")
        }
      }
    }
  }

  private func providerDetail(_ provider: VoiceProvider, _ snapshot: VoiceSnapshot) -> LocalizedStringKey {
    if snapshot.credential(for: provider.id) != nil { return "Connected" }
    return provider.transcribe ? "Speak + transcribe" : "Speak only"
  }

  private func connect(_ provider: String, _ snapshot: VoiceSnapshot) {
    let key = apiKey.trimmingCharacters(in: .whitespacesAndNewlines)
    guard key.count >= 8, !model.busy else { return }
    Task {
      if await model.connect(app, provider: provider, apiKey: key) {
        apiKey = ""
        await select(provider, model.state.value ?? snapshot)
      }
    }
  }

  private func select(_ id: String?, _ snapshot: VoiceSnapshot) async {
    providerID = id
    apiKey = ""
    model.error = nil
    model.voices = []
    guard let id else { return }
    speechModel = snapshot.credential(for: id)?.speechModel ?? ""
    if snapshot.credential(for: id) != nil { await model.loadVoices(app, provider: id) }
  }
}
