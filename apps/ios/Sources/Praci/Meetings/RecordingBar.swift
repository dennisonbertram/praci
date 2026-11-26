import SwiftUI

/// The strip above every screen while a recording runs or is being stored.
struct RecordingBar: View {
  @Environment(AppModel.self) private var app

  var body: some View {
    if app.capture.live == nil, let id = app.capture.savedMeetingID {
      HStack(spacing: 10) {
        Text("Meeting saved").font(.subheadline.weight(.medium))
        Spacer(minLength: 8)
        Button("Open") {
          app.capture.dismissSaved()
          app.open(.meeting(id: id))
        }
        .buttonStyle(.glassProminent)
        .controlSize(.small)
        .accessibilityIdentifier("meetingSavedOpen")
      }
      .padding(.horizontal, 16)
      .padding(.vertical, 8)
      .glassEffect(.regular, in: Capsule())
      .padding(.horizontal, 12)
      .padding(.bottom, 4)
      .accessibilityElement(children: .contain)
      .accessibilityIdentifier("meetingSavedBar")
    } else if let live = app.capture.live {
      HStack(spacing: 10) {
        Circle().fill(Color.token(.destructive)).frame(width: 10, height: 10)
          .opacity(live.transcribing ? 0.4 : 1)
        VStack(alignment: .leading, spacing: 0) {
          Text(live.title ?? "Recording").font(.subheadline.weight(.medium)).lineLimit(1)
          if live.transcribing {
            Text("Transcribing…").font(.caption).foregroundStyle(Color.token(.mutedForeground))
          } else if live.offline {
            Text("Offline, saved here").font(.caption).foregroundStyle(Color.token(.mutedForeground))
          }
        }
        Spacer(minLength: 8)
        if !live.transcribing {
          Text(live.startedAt, style: .timer).font(.subheadline.monospacedDigit())
            .foregroundStyle(Color.token(.mutedForeground))
          Button("Stop") { Task { await app.capture.stop() } }
            .buttonStyle(.glassProminent)
            .controlSize(.small)
            .accessibilityIdentifier("recordStop")
        }
      }
      .padding(.horizontal, 16)
      .padding(.vertical, 8)
      .glassEffect(.regular, in: Capsule())
      .padding(.horizontal, 12)
      .padding(.bottom, 4)
      .accessibilityElement(children: .contain)
      .accessibilityIdentifier("recordingBar")
    }
  }
}
