import Observation
import RakazoCore
import SwiftUI

/// Dictation into the composer: on-device speech recognition, ended by a 1.2 s pause or a tap.
@MainActor
@Observable
final class DictationModel {
  private(set) var listening = false
  /// Shown under the composer when dictation cannot start; the Settings link goes with it.
  var message: String?
  @ObservationIgnored private var session: DictationSession?
  /// Bumped by `stop()` so a start still waiting on a permission prompt does not begin afterwards.
  @ObservationIgnored private var epoch = 0

  func toggle(text: Binding<String>) async {
    if listening { stop(); return }
    guard !VoiceAudio.meetingActive else { return }
    message = nil
    let started = epoch
    guard VoiceAudio.onDeviceSupported() else { message = VoiceAudio.dictationUnavailable; return }
    guard await VoiceAudio.requestMicrophone() else { message = VoiceAudio.micDenied; return }
    guard await VoiceAudio.requestSpeech() else { message = VoiceAudio.speechDenied; return }
    guard epoch == started else { return }
    let base = text.wrappedValue.trimmingCharacters(in: .whitespacesAndNewlines)
    let set: (String) -> Void = { heard in text.wrappedValue = base.isEmpty ? heard : "\(base) \(heard)" }
    let next = DictationSession(
      recognizer: DeviceSpeechRecognizer(), language: VoiceAudio.language,
      onInterim: set, onFinal: set, onDone: { [weak self] in self?.stop() })
    session = next
    listening = true
    next.begin()
  }

  func stop() {
    epoch += 1
    session?.stop()
    session = nil
    listening = false
    VoiceAudio.deactivate()
  }
}

/// The composer's trailing control while the field is empty (Dictate) or dictation runs (Stop).
struct DictationButton: View {
  let model: DictationModel
  @Binding var text: String
  @Environment(AppModel.self) private var app

  var body: some View {
    Button { Task { await model.toggle(text: $text) } } label: {
      Image(systemName: model.listening ? "stop.fill" : "mic").frame(width: 30, height: 30)
        .foregroundStyle(Color.token(.primaryForeground))
    }
    .buttonStyle(.glassProminent)
    .buttonBorderShape(.circle)
    .disabled(app.capture.isBusy)
    .accessibilityLabel(model.listening ? "Stop dictation" : "Dictate")
    .accessibilityIdentifier("dictate")
  }
}

/// A short message when dictation is blocked by a permission, with the way to fix it.
struct DictationNotice: View {
  let model: DictationModel
  @Environment(\.openURL) private var openURL

  var body: some View {
    if let message = model.message {
      HStack {
        Text(message).font(.footnote).foregroundStyle(Color.token(.destructive))
        Button("Open Settings") {
          if let url = URL(string: UIApplication.openSettingsURLString) { openURL(url) }
        }
        .font(.footnote)
        .accessibilityIdentifier("dictationOpenSettings")
      }
      .accessibilityIdentifier("dictationNotice")
    }
  }
}
