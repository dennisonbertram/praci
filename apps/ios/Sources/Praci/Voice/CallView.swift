import RakazoCore
import RakazoUI
import SwiftUI

/// The toolbar button that rings the agent and presents the full-screen call.
struct CallButton: View {
  let botID: String
  let name: String
  let avatar: String?
  @Environment(AppModel.self) private var app
  @State private var coordinator = CallCoordinator()
  @State private var presenting = false
  @Environment(\.scenePhase) private var scenePhase

  var body: some View {
    Button {
      presenting = true
      Task { await coordinator.begin(app: app, botID: botID, name: name, color: avatar) }
    } label: {
      Label("Call", systemImage: "phone")
    }
    .disabled(app.capture.isBusy)
    .accessibilityIdentifier("call")
    // swiftlint:disable:next multiple_closures_with_trailing_closure
    .fullScreenCover(isPresented: $presenting, onDismiss: { coordinator.end() }) {
      CallView(coordinator: coordinator, name: name, avatar: avatar, close: { presenting = false })
    }
    // The app does not keep the microphone in the background, so going to the background hangs up.
    // Not on .inactive: permission prompts, Control Center and incoming alerts pass through it.
    .onChange(of: scenePhase) { _, phase in
      guard phase == .background else { return }
      coordinator.end()
      presenting = false
    }
    // The agent hung up, or the caller did: the call screen goes away with the call.
    .onChange(of: coordinator.isActive) { wasActive, active in
      if wasActive && !active { presenting = false }
    }
  }
}

struct CallView: View {
  let coordinator: CallCoordinator
  let name: String
  let avatar: String?
  let close: () -> Void
  @Environment(\.openURL) private var openURL

  var body: some View {
    VStack(spacing: 16) {
      Spacer(minLength: 24)
      BotAvatarView(name: name, avatar: avatar, size: 112)
      Text(name).font(.title2.weight(.semibold))
      if let state = coordinator.session?.state {
        status(state)
        message(state)
        if state.transcriptOpen { transcript(state) } else { Spacer() }
        controls(state)
      } else if let failure = coordinator.failure {
        Text(failure).multilineTextAlignment(.center).foregroundStyle(Color.token(.destructive))
          .accessibilityIdentifier("callFailure")
        Spacer()
        Button("Close", action: close).buttonStyle(.glass).accessibilityIdentifier("callClose")
      } else {
        ProgressView().accessibilityIdentifier("callConnecting")
        Spacer()
      }
    }
    .padding(.horizontal, 24).padding(.bottom, 24)
    .frame(maxWidth: .infinity, maxHeight: .infinity)
    .background(Color.token(.background))
    .accessibilityIdentifier("callScreen")
  }

  private func status(_ state: CallState) -> some View {
    TimelineView(.periodic(from: .now, by: 1)) { context in
      HStack(spacing: 6) {
        Text(label(state))
        Text("·")
        Text(elapsed(context.date)).monospacedDigit()
      }
      .font(.subheadline).foregroundStyle(Color.token(.mutedForeground))
    }
    .accessibilityIdentifier("callStatus")
  }

  @State private var started = Date()

  private func elapsed(_ now: Date) -> String {
    let seconds = max(0, Int(now.timeIntervalSince(started)))
    return String(format: "%02d:%02d", seconds / 60, seconds % 60)
  }

  private func label(_ state: CallState) -> LocalizedStringKey {
    if state.muted { return "Muted" }
    switch state.phase {
    case .listening: return "Listening"
    case .thinking: return "Thinking"
    case .speaking: return "Speaking"
    }
  }

  @ViewBuilder private func message(_ state: CallState) -> some View {
    if !state.caption.isEmpty {
      VStack(spacing: 8) {
        Text(state.caption).font(.footnote).multilineTextAlignment(.center)
          .foregroundStyle(Color.token(.destructive))
          .accessibilityIdentifier("callCaption")
        if state.needsSettings {
          Button("Open Settings") {
            if let url = URL(string: UIApplication.openSettingsURLString) { openURL(url) }
          }
          .buttonStyle(.glass).accessibilityIdentifier("callOpenSettings")
        }
      }
    } else if !state.heard.isEmpty {
      Text(state.heard).font(.body).multilineTextAlignment(.center)
        .foregroundStyle(Color.token(.mutedForeground)).lineLimit(3)
        .accessibilityIdentifier("callHeard")
    }
  }

  private func transcript(_ state: CallState) -> some View {
    ScrollView {
      LazyVStack(alignment: .leading, spacing: 8) {
        if state.exchanges.isEmpty {
          Text("Nothing said yet.").foregroundStyle(Color.token(.mutedForeground))
        }
        ForEach(Array(state.exchanges.enumerated()), id: \.offset) { _, exchange in
          Text(exchange.text)
            .padding(.horizontal, 12).padding(.vertical, 8)
            .background(
              exchange.role == .user ? Color.token(.chatUser) : Color.token(.muted),
              in: RoundedRectangle(cornerRadius: 16)
            )
            .foregroundStyle(
              exchange.role == .user ? Color.token(.chatUserForeground) : Color.token(.foreground)
            )
            .frame(maxWidth: .infinity, alignment: exchange.role == .user ? .trailing : .leading)
        }
      }
    }
    .accessibilityIdentifier("callTranscript")
  }

  private func controls(_ state: CallState) -> some View {
    GlassEffectContainer(spacing: 20) {
      HStack(spacing: 20) {
        round("Transcript", "text.bubble", id: "callTranscriptToggle") {
          coordinator.session?.toggleTranscript()
        }
        round("Mute", state.muted ? "mic.slash" : "mic", id: "callMute") {
          coordinator.session?.toggleMute()
        }
        Button { coordinator.end() } label: {
          Label("Hang up", systemImage: "phone.down.fill").labelStyle(.iconOnly)
            .font(.title3).frame(width: 56, height: 56)
        }
        .buttonStyle(.glassProminent).buttonBorderShape(.circle)
        .tint(Color.token(.destructive))
        .accessibilityIdentifier("callHangUp")
      }
    }
  }

  private func round(
    _ title: LocalizedStringKey, _ symbol: String, id: String, action: @escaping () -> Void
  ) -> some View {
    Button(action: action) {
      Label(title, systemImage: symbol).labelStyle(.iconOnly)
        .font(.title3).frame(width: 56, height: 56)
    }
    .buttonStyle(.glass).buttonBorderShape(.circle)
    .accessibilityIdentifier(id)
  }
}
