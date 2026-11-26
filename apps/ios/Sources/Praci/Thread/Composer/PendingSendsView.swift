import RakazoAPI
import RakazoCore
import SwiftUI

/// Messages that have not reached the thread yet, plus ones the server just accepted that the
/// live stream has not delivered. Queued shows "Waiting to send", failed shows Retry.
struct PendingSendsView: View {
  let model: ThreadModel
  @Environment(AppModel.self) private var app

  var body: some View {
    let queue = SendQueue.shared
    let key = model.composer.originKey
    let cursor = model.snapshot?.cursor ?? 0
    ForEach(queue.echoes(thread: key, cursor: cursor), id: \.clientNonce) { attempt in
      bubble(attempt, border: false)
    }
    ForEach(queue.pending(thread: key), id: \.clientNonce) { attempt in
      VStack(alignment: .trailing, spacing: 4) {
        bubble(attempt, border: attempt.state == .failed || attempt.state == .refused)
          .opacity(attempt.state == .failed || attempt.state == .refused ? 1 : 0.7)
        caption(attempt)
      }
      .contextMenu {
        if attempt.state == .failed {
          Button { queue.retry(attempt.clientNonce, app) } label: {
            Label("Retry", systemImage: "arrow.counterclockwise")
          }
        }
        Button(role: .destructive) { queue.delete(attempt.clientNonce) } label: {
          Label("Delete", systemImage: "trash")
        }
      }
      .accessibilityIdentifier("pendingSend")
    }
  }

  private func bubble(_ attempt: SendAttempt, border: Bool) -> some View {
    VStack(alignment: .trailing, spacing: 6) {
      ForEach(attempt.payload.attachments, id: \.id) { file in
        Label(file.name, systemImage: file.mimeType.hasPrefix("image/") ? "photo" : "doc")
          .font(.footnote).foregroundStyle(Color.token(.chatUserForeground))
      }
      if !attempt.payload.displayText.isEmpty {
        Text(attempt.payload.displayText).foregroundStyle(Color.token(.chatUserForeground))
      }
    }
    .padding(.horizontal, 16).padding(.vertical, 10)
    .background(Color.token(.chatUser), in: RoundedRectangle(cornerRadius: 20))
    .overlay {
      if border { RoundedRectangle(cornerRadius: 20).stroke(Color.token(.destructive)) }
    }
    .frame(maxWidth: .infinity, alignment: .trailing)
    .padding(.leading, 48)
  }

  @ViewBuilder private func caption(_ attempt: SendAttempt) -> some View {
    switch attempt.state {
    case .queued:
      Text("Waiting to send").font(.caption).foregroundStyle(Color.token(.mutedForeground))
    case .pending:
      Text("Sending").font(.caption).foregroundStyle(Color.token(.mutedForeground))
    case .failed:
      HStack(spacing: 8) {
        Label("Not sent", systemImage: "exclamationmark.circle")
          .font(.caption).foregroundStyle(Color.token(.destructive))
        Button { SendQueue.shared.retry(attempt.clientNonce, app) } label: {
          Label("Retry", systemImage: "arrow.counterclockwise").font(.footnote.weight(.semibold))
            .frame(minHeight: 44)
        }
        .accessibilityIdentifier("retrySend")
      }
    case .refused:
      HStack(spacing: 8) {
        Text("Not sent: \(attempt.error ?? "The server refused this message.")")
          .font(.caption).foregroundStyle(Color.token(.destructive))
        Button("Delete") { SendQueue.shared.delete(attempt.clientNonce) }
          .font(.footnote.weight(.semibold)).frame(minHeight: 44)
      }
    }
  }
}
