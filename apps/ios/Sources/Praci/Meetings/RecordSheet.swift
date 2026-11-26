import Observation
import RakazoAPI
import SwiftUI

/// What the space and the voice settings allow before a recording can start.
@MainActor
@Observable
final class RecordModel {
  struct Options: Equatable {
    let spaceID: String
    /// "remind", "confirm" or "off".
    let policy: String
    /// A hosted provider is set up, consented to, and transcribes speech.
    let serverTranscribes: Bool
  }

  private(set) var options: Options?

  func load(_ app: AppModel) async {
    async let boot: Bootstrap? = try? await app.call("bootstrap")
    async let voice: VoiceStatus? = try? await app.call("voice/status")
    guard let boot = await boot else { return }
    let status = await voice
    let space = boot.spaces.first { $0.id == boot.me.spaceId }
    options = Options(
      spaceID: boot.me.spaceId, policy: space?.meetingRecording ?? "remind",
      serverTranscribes: status.map {
        ($0.transcribe || $0.transcriptionReady) && $0.transcriptionConsented != false
      } ?? false)
  }
}

/// The sheet behind Record: an optional title, the space's recording notice, and Start.
struct RecordSheet: View {
  let model: RecordModel
  @Environment(AppModel.self) private var app
  @Environment(\.dismiss) private var dismiss
  @State private var title = ""
  @State private var agreed = false
  @State private var failure: String?
  @State private var starting = false

  private var placeholder: String {
    "Meeting \(Date.now.formatted(date: .omitted, time: .shortened))"
  }

  private var confirm: Bool { model.options?.policy == "confirm" }

  var body: some View {
    NavigationStack {
      if let options = model.options {
        if options.serverTranscribes {
          form(options)
        } else {
          Form {
            NavigationLink("Add speech to text") { VoiceSettingsScreen() }
              .accessibilityIdentifier("addSpeechToText")
          }
          .toolbar { cancel }
          // Back from Voice settings the provider may be set up now.
          .onAppear { Task { await model.load(app) } }
        }
      }
    }
    // Fixed heights cut off Voice settings and large text, so use the system sizes: the form at
    // half height, and full height while Voice settings can be opened.
    .presentationDetents(model.options?.serverTranscribes == true ? [.medium, .large] : [.large])
  }

  private func form(_ options: RecordModel.Options) -> some View {
    Form {
      Section {
        TextField("Title", text: $title, prompt: Text(placeholder))
          .accessibilityIdentifier("recordTitle")
        if confirm {
          Toggle("Everyone agreed to be recorded", isOn: $agreed)
            .accessibilityIdentifier("recordConsent")
        }
      } footer: {
        if !confirm { Text("Tell everyone you're recording.") }
        if let failure { Text(failure).foregroundStyle(Color.token(.destructive)) }
      }
    }
    .toolbar {
      cancel
      ToolbarItem(placement: .confirmationAction) {
        Button("Start") { Task { await start(options) } }
          .disabled(starting || (confirm && !agreed))
          .accessibilityIdentifier("recordStart")
      }
    }
  }

  private var cancel: some ToolbarContent {
    ToolbarItem(placement: .cancellationAction) {
      Button("Cancel") { dismiss() }.accessibilityIdentifier("recordCancel")
    }
  }

  private func start(_ options: RecordModel.Options) async {
    starting = true
    failure = nil
    defer { starting = false }
    let trimmed = title.trimmingCharacters(in: .whitespacesAndNewlines)
    do {
      try await app.capture.start(
        spaceID: options.spaceID, title: trimmed.isEmpty ? placeholder : trimmed,
        consentConfirmed: confirm && agreed)
      dismiss()
    } catch {
      failure = error.localizedDescription
    }
  }
}
